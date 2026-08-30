#![allow(
    deprecated,
    unexpected_cfgs,
    clippy::needless_as_bytes,
    clippy::needless_range_loop
)]
use anchor_lang::prelude::*;
declare_id!("Gx4szwkK1wMYpyZJ6y168ytuPNfC3gq9kehg3XjgMNkV");
const DENOMINATOR: u128 = 10_000;
const MIN_TOKEN_RESERVE: u64 = 1_000;
const MAX_RESERVE: u64 = 1u64 << 63;

#[program]
pub mod norr_market {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
        require!(
            args.virtual_base > 0 && args.token_reserve >= MIN_TOKEN_RESERVE,
            MarketError::BoundsExceeded
        );
        require!(args.fee_bps <= 1_000, MarketError::FeeTooHigh);
        let curve = &mut ctx.accounts.curve;
        curve.launch = ctx.accounts.launch.key();
        curve.project_mint = args.project_mint;
        curve.base_mint = args.base_mint;
        curve.token_vault = args.token_vault;
        curve.base_vault = args.base_vault;
        curve.router = args.router;
        curve.liquidity_beneficiary = args.liquidity_beneficiary;
        curve.damm_position = Pubkey::default();
        curve.virtual_base = args.virtual_base;
        curve.base_reserve = 0;
        curve.token_reserve = args.token_reserve;
        curve.graduation_target = args.graduation_target;
        curve.fee_bps = args.fee_bps;
        curve.active = false;
        curve.graduated = false;
        curve.created_slot = Clock::get()?.slot;
        curve.max_buy_first_slots = args.max_buy_first_slots;
        curve.liquidity_unlock_at = args.liquidity_unlock_at;
        curve.bump = ctx.bumps.curve;
        Ok(())
    }
    pub fn activate(ctx: Context<Configure>) -> Result<()> {
        ctx.accounts.curve.active = true;
        Ok(())
    }
    pub fn buy(ctx: Context<Trade>, base_in: u64, min_out: u64) -> Result<()> {
        let curve = &mut ctx.accounts.curve;
        require!(curve.active, MarketError::ActivationChecklistRequired);
        require!(!curve.graduated, MarketError::ActivationChecklistRequired); // Or another error

        // Quote
        let (fee, net, tokens_out) = quote_buy(
            curve.virtual_base,
            curve.base_reserve,
            curve.token_reserve,
            base_in,
            curve.fee_bps,
        )?;
        require!(tokens_out >= min_out, MarketError::BoundsExceeded); // slippage

        // Transfer base_in from user to base_vault (net)
        anchor_spl::token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.user_base_token.to_account_info(),
                    to: ctx.accounts.base_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            net,
        )?;

        // Transfer fee from user to router_vault
        if fee > 0 {
            anchor_spl::token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    anchor_spl::token::Transfer {
                        from: ctx.accounts.user_base_token.to_account_info(),
                        to: ctx.accounts.router_vault.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                fee,
            )?;
        }

        // Transfer tokens_out from token_vault to user
        let project_mint = curve.project_mint;
        let bump = curve.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"curve", project_mint.as_ref(), &[bump]]];

        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.token_vault.to_account_info(),
                    to: ctx.accounts.user_project_token.to_account_info(),
                    authority: curve.to_account_info(),
                },
                signer_seeds,
            ),
            tokens_out,
        )?;

        // Update reserves
        curve.base_reserve = curve
            .base_reserve
            .checked_add(net)
            .ok_or(MarketError::MathOverflow)?;
        curve.token_reserve = curve
            .token_reserve
            .checked_sub(tokens_out)
            .ok_or(MarketError::MathOverflow)?;

        Ok(())
    }
    pub fn sell(ctx: Context<Trade>, tokens_in: u64, min_out: u64) -> Result<()> {
        let curve = &mut ctx.accounts.curve;
        require!(curve.active, MarketError::ActivationChecklistRequired);
        require!(!curve.graduated, MarketError::ActivationChecklistRequired);

        let (gross, fee, base_out, new_effective_base) = quote_sell(
            curve.virtual_base,
            curve.base_reserve,
            curve.token_reserve,
            tokens_in,
            curve.fee_bps,
        )?;
        require!(base_out >= min_out, MarketError::BoundsExceeded);

        // Transfer tokens_in from user to token_vault
        anchor_spl::token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.user_project_token.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            tokens_in,
        )?;

        // Transfer base_out from base_vault to user
        let project_mint = curve.project_mint;
        let bump = curve.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"curve", project_mint.as_ref(), &[bump]]];

        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.base_vault.to_account_info(),
                    to: ctx.accounts.user_base_token.to_account_info(),
                    authority: curve.to_account_info(),
                },
                signer_seeds,
            ),
            base_out,
        )?;

        // Transfer fee from base_vault to router_vault
        if fee > 0 {
            anchor_spl::token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    anchor_spl::token::Transfer {
                        from: ctx.accounts.base_vault.to_account_info(),
                        to: ctx.accounts.router_vault.to_account_info(),
                        authority: curve.to_account_info(),
                    },
                    signer_seeds,
                ),
                fee,
            )?;
        }

        // Update reserves
        curve.token_reserve = curve
            .token_reserve
            .checked_add(tokens_in)
            .ok_or(MarketError::MathOverflow)?;
        curve.base_reserve = curve
            .base_reserve
            .checked_sub(gross)
            .ok_or(MarketError::MathOverflow)?;
        curve.virtual_base = new_effective_base
            .checked_sub(curve.base_reserve)
            .ok_or(MarketError::MathOverflow)?;

        Ok(())
    }
    pub fn graduate(_ctx: Context<Configure>) -> Result<()> {
        err!(MarketError::DammIntegrationRequired)
    }
}

pub fn ceil_div(n: u128, d: u128) -> Result<u128> {
    require!(d > 0, MarketError::BoundsExceeded);
    Ok(n / d + u128::from(n % d != 0))
}

pub fn quote_buy(
    virtual_base: u64,
    base_reserve: u64,
    token_reserve: u64,
    base_in: u64,
    fee_bps: u16,
) -> Result<(u64, u64, u64)> {
    require!(base_in > 0 && fee_bps <= 1_000, MarketError::FeeTooHigh);
    let effective = virtual_base
        .checked_add(base_reserve)
        .ok_or(MarketError::MathOverflow)?;
    require!(
        effective <= MAX_RESERVE && (MIN_TOKEN_RESERVE..=MAX_RESERVE).contains(&token_reserve),
        MarketError::BoundsExceeded
    );
    let fee = u64::try_from(u128::from(base_in) * u128::from(fee_bps) / DENOMINATOR)
        .map_err(|_| MarketError::MathOverflow)?;
    let net = base_in.checked_sub(fee).ok_or(MarketError::MathOverflow)?;
    let k = u128::from(effective)
        .checked_mul(u128::from(token_reserve))
        .ok_or(MarketError::MathOverflow)?;
    let new_reserve = u64::try_from(ceil_div(
        k,
        u128::from(
            effective
                .checked_add(net)
                .ok_or(MarketError::MathOverflow)?,
        ),
    )?)
    .map_err(|_| MarketError::MathOverflow)?;
    require!(
        new_reserve >= MIN_TOKEN_RESERVE,
        MarketError::InsufficientReserve
    );
    Ok((
        fee,
        net,
        token_reserve
            .checked_sub(new_reserve)
            .ok_or(MarketError::MathOverflow)?,
    ))
}

pub fn quote_sell(
    virtual_base: u64,
    base_reserve: u64,
    token_reserve: u64,
    tokens_in: u64,
    fee_bps: u16,
) -> Result<(u64, u64, u64, u64)> {
    require!(tokens_in > 0 && fee_bps <= 1_000, MarketError::FeeTooHigh);
    let effective_base = virtual_base
        .checked_add(base_reserve)
        .ok_or(MarketError::MathOverflow)?;
    require!(
        effective_base <= MAX_RESERVE && (MIN_TOKEN_RESERVE..=MAX_RESERVE).contains(&token_reserve),
        MarketError::BoundsExceeded
    );

    let new_token_reserve = token_reserve
        .checked_add(tokens_in)
        .ok_or(MarketError::MathOverflow)?;
    require!(
        new_token_reserve <= MAX_RESERVE,
        MarketError::BoundsExceeded
    );

    let invariant = u128::from(effective_base)
        .checked_mul(u128::from(token_reserve))
        .ok_or(MarketError::MathOverflow)?;
    let new_effective_base = u64::try_from(ceil_div(invariant, u128::from(new_token_reserve))?)
        .map_err(|_| MarketError::MathOverflow)?;

    let curve_gross = effective_base
        .checked_sub(new_effective_base)
        .ok_or(MarketError::MathOverflow)?;
    let gross = if curve_gross < base_reserve {
        curve_gross
    } else {
        base_reserve
    };
    require!(gross > 0, MarketError::InsufficientReserve);

    let fee = u64::try_from(u128::from(gross) * u128::from(fee_bps) / DENOMINATOR)
        .map_err(|_| MarketError::MathOverflow)?;
    let base_out = gross.checked_sub(fee).ok_or(MarketError::MathOverflow)?;
    require!(base_out > 0, MarketError::InsufficientReserve);

    Ok((gross, fee, base_out, new_effective_base))
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeArgs {
    pub project_mint: Pubkey,
    pub base_mint: Pubkey,
    pub token_vault: Pubkey,
    pub base_vault: Pubkey,
    pub router: Pubkey,
    pub liquidity_beneficiary: Pubkey,
    pub virtual_base: u64,
    pub token_reserve: u64,
    pub graduation_target: u64,
    pub fee_bps: u16,
    pub max_buy_first_slots: u64,
    pub liquidity_unlock_at: i64,
}
#[derive(Accounts)]
#[instruction(args:InitializeArgs)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: deterministic Launch PDA.
    pub launch: UncheckedAccount<'info>,
    #[account(init,payer=payer,space=Curve::LEN,seeds=[b"curve",args.project_mint.as_ref()],bump)]
    pub curve: Account<'info, Curve>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Trade<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"curve", curve.project_mint.as_ref()],
        bump = curve.bump,
        has_one = token_vault,
        has_one = base_vault,
        has_one = router,
    )]
    pub curve: Account<'info, Curve>,

    #[account(mut, constraint = user_base_token.owner == user.key(), constraint = user_base_token.mint == curve.base_mint)]
    pub user_base_token: Account<'info, anchor_spl::token::TokenAccount>,

    #[account(mut, constraint = user_project_token.owner == user.key(), constraint = user_project_token.mint == curve.project_mint)]
    pub user_project_token: Account<'info, anchor_spl::token::TokenAccount>,

    #[account(mut, constraint = base_vault.owner == curve.key())]
    pub base_vault: Account<'info, anchor_spl::token::TokenAccount>,

    #[account(mut, constraint = token_vault.owner == curve.key())]
    pub token_vault: Account<'info, anchor_spl::token::TokenAccount>,

    #[account(mut, constraint = router_vault.owner == router.key())]
    pub router_vault: Account<'info, anchor_spl::token::TokenAccount>,

    /// CHECK: Checked by curve.router constraint
    pub router: UncheckedAccount<'info>,

    pub token_program: Program<'info, anchor_spl::token::Token>,
}

#[derive(Accounts)]
pub struct Configure<'info> {
    #[account(mut,seeds=[b"curve",curve.project_mint.as_ref()],bump=curve.bump)]
    pub curve: Account<'info, Curve>,
}
#[account]
pub struct Curve {
    pub launch: Pubkey,
    pub project_mint: Pubkey,
    pub base_mint: Pubkey,
    pub token_vault: Pubkey,
    pub base_vault: Pubkey,
    pub router: Pubkey,
    pub liquidity_beneficiary: Pubkey,
    pub damm_position: Pubkey,
    pub virtual_base: u64,
    pub base_reserve: u64,
    pub token_reserve: u64,
    pub graduation_target: u64,
    pub fee_bps: u16,
    pub active: bool,
    pub graduated: bool,
    pub created_slot: u64,
    pub max_buy_first_slots: u64,
    pub liquidity_unlock_at: i64,
    pub bump: u8,
}
impl Curve {
    pub const LEN: usize = 8 + 32 * 8 + 8 * 4 + 2 + 1 + 1 + 8 + 8 + 8 + 1;
}
#[error_code]
pub enum MarketError {
    #[msg("Fee too high")]
    FeeTooHigh,
    #[msg("Insufficient reserve")]
    InsufficientReserve,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Bounds exceeded")]
    BoundsExceeded,
    #[msg("Activation checklist required")]
    ActivationChecklistRequired,
    #[msg("Canonical token transfer adapter required")]
    TokenTransferAdapterRequired,
    #[msg("Pinned Meteora DAMM v2 adapter required")]
    DammIntegrationRequired,
}
