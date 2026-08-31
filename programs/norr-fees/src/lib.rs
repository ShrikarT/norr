#![allow(
    deprecated,
    unexpected_cfgs,
    clippy::needless_as_bytes,
    clippy::needless_range_loop
)]
use anchor_lang::prelude::*;
declare_id!("3VNFr1kkLv1mQkpWQSNBJhDJbpLsELPPF7f5YMWHjMy8");
const DENOMINATOR: u64 = 10_000;
const MAX_SPLITS: usize = 8;

#[program]
pub mod norr_fees {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, values: Vec<SplitInput>) -> Result<()> {
        validate(&values)?;
        let router = &mut ctx.accounts.router;
        router.launch = ctx.accounts.launch.key();
        router.authority = ctx.accounts.authority.key();
        router.asset_mint = ctx.accounts.asset_mint.key();
        router.vault = ctx.accounts.vault.key();
        router.total_received = 0;
        router.total_released = 0;
        router.locked = false;
        router.split_count = u8::try_from(values.len()).map_err(|_| FeeError::BoundsExceeded)?;
        router.splits = [Split::default(); MAX_SPLITS];
        for (index, value) in values.iter().enumerate() {
            router.splits[index] = value.into();
        }
        router.bump = ctx.bumps.router;
        Ok(())
    }
    pub fn lock(ctx: Context<Configure>) -> Result<()> {
        require!(!ctx.accounts.router.locked, FeeError::AlreadyLocked);
        ctx.accounts.router.locked = true;
        emit!(RouterLocked {
            router: ctx.accounts.router.key()
        });
        Ok(())
    }
    pub fn sync(ctx: Context<Sync>) -> Result<()> {
        let router = &mut ctx.accounts.router;
        require!(router.locked, FeeError::NotReady);
        let tracked = router
            .total_received
            .checked_sub(router.total_released)
            .ok_or(FeeError::MathOverflow)?;
        let delta = ctx
            .accounts
            .vault
            .amount
            .checked_sub(tracked)
            .ok_or(FeeError::Insolvent)?;
        if delta == 0 {
            return Ok(());
        }
        let count = usize::from(router.split_count);
        let remainder = (0..count)
            .max_by_key(|i| (router.splits[*i].bps, std::cmp::Reverse(*i)))
            .ok_or(FeeError::NoSplits)?;
        let mut additions = [0u64; MAX_SPLITS];
        let mut allocated = 0u64;
        for index in 0..count {
            if index == remainder {
                continue;
            }
            let raw = u128::from(delta)
                .checked_mul(u128::from(router.splits[index].bps))
                .ok_or(FeeError::MathOverflow)?
                / u128::from(DENOMINATOR);
            additions[index] = u64::try_from(raw).map_err(|_| FeeError::MathOverflow)?;
            allocated = allocated
                .checked_add(additions[index])
                .ok_or(FeeError::MathOverflow)?;
        }
        additions[remainder] = delta.checked_sub(allocated).ok_or(FeeError::MathOverflow)?;
        for index in 0..count {
            router.splits[index].accrued = router.splits[index]
                .accrued
                .checked_add(additions[index])
                .ok_or(FeeError::MathOverflow)?;
        }
        router.total_received = router
            .total_received
            .checked_add(delta)
            .ok_or(FeeError::MathOverflow)?;
        emit!(Synced {
            router: router.key(),
            amount: delta
        });
        Ok(())
    }
    pub fn release(ctx: Context<Release>, split_index: u8) -> Result<()> {
        let router = &mut ctx.accounts.router;
        require!(router.locked, FeeError::NotReady);
        let index = split_index as usize;
        require!(
            index < usize::from(router.split_count),
            FeeError::BoundsExceeded
        );

        let recipient;
        let amount;
        {
            let split = &mut router.splits[index];
            amount = split
                .accrued
                .checked_sub(split.released)
                .ok_or(FeeError::MathOverflow)?;
            if amount == 0 {
                return Ok(());
            }
            split.released = split
                .released
                .checked_add(amount)
                .ok_or(FeeError::MathOverflow)?;
            recipient = split.recipient;
        }
        router.total_released = router
            .total_released
            .checked_add(amount)
            .ok_or(FeeError::MathOverflow)?;

        let launch_key = router.launch;
        let bump = router.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"router", launch_key.as_ref(), &[bump]]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.recipient_token.to_account_info(),
                authority: router.to_account_info(),
            },
            signer_seeds,
        );
        anchor_spl::token::transfer(cpi_ctx, amount)?;

        emit!(Released {
            router: router.key(),
            recipient,
            amount
        });
        Ok(())
    }
}

fn validate(values: &[SplitInput]) -> Result<()> {
    require!(
        !values.is_empty() && values.len() <= MAX_SPLITS,
        FeeError::NoSplits
    );
    let mut total = 0u64;
    for (index, value) in values.iter().enumerate() {
        require!(
            value.recipient != Pubkey::default(),
            FeeError::ZeroRecipient
        );
        require!(value.bps > 0, FeeError::ZeroBps);
        require!(
            !values[..index]
                .iter()
                .any(|prior| prior.recipient == value.recipient),
            FeeError::DuplicateRecipient
        );
        total = total
            .checked_add(u64::from(value.bps))
            .ok_or(FeeError::MathOverflow)?;
    }
    require!(total == DENOMINATOR, FeeError::BpsMustTotalDenominator);
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: deterministic Launch PDA; identity only during resumable setup.
    pub launch: UncheckedAccount<'info>,
    /// CHECK: pinned legacy SPL mint, validated during activation.
    pub asset_mint: UncheckedAccount<'info>,
    /// CHECK: canonical Router-owned token account, validated before value movement.
    pub vault: UncheckedAccount<'info>,
    #[account(init, payer = authority, space = Router::LEN, seeds = [b"router", launch.key().as_ref()], bump)]
    pub router: Account<'info, Router>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Configure<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"router", router.launch.as_ref()], bump=router.bump, has_one=authority)]
    pub router: Account<'info, Router>,
}
#[derive(Accounts)]
pub struct Sync<'info> {
    #[account(mut, seeds=[b"router", router.launch.as_ref()], bump=router.bump, has_one=vault)]
    pub router: Account<'info, Router>,
    #[account(constraint=vault.owner == router.key(), constraint=vault.mint == router.asset_mint)]
    pub vault: Account<'info, anchor_spl::token::TokenAccount>,
}

#[derive(Accounts)]
#[instruction(split_index: u8)]
pub struct Release<'info> {
    #[account(
        mut,
        seeds=[b"router", router.launch.as_ref()],
        bump=router.bump,
        has_one=vault
    )]
    pub router: Account<'info, Router>,

    #[account(
        mut,
        constraint=vault.owner == router.key(),
        constraint=vault.mint == router.asset_mint
    )]
    pub vault: Account<'info, anchor_spl::token::TokenAccount>,

    #[account(
        mut,
        address = anchor_spl::associated_token::get_associated_token_address(&router.splits[split_index as usize].recipient, &router.asset_mint)
    )]
    pub recipient_token: Account<'info, anchor_spl::token::TokenAccount>,

    pub token_program: Program<'info, anchor_spl::token::Token>,
}

#[account]
pub struct Router {
    pub launch: Pubkey,
    pub authority: Pubkey,
    pub asset_mint: Pubkey,
    pub vault: Pubkey,
    pub total_received: u64,
    pub total_released: u64,
    pub locked: bool,
    pub split_count: u8,
    pub splits: [Split; MAX_SPLITS],
    pub bump: u8,
}
impl Router {
    pub const LEN: usize = 8 + 32 * 4 + 8 + 8 + 1 + 1 + 8 * Split::LEN + 1;
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct Split {
    pub recipient: Pubkey,
    pub bps: u16,
    pub category: u8,
    pub accrued: u64,
    pub released: u64,
}
impl Split {
    pub const LEN: usize = 32 + 2 + 1 + 8 + 8;
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SplitInput {
    pub recipient: Pubkey,
    pub bps: u16,
    pub category: u8,
}
impl From<&SplitInput> for Split {
    fn from(value: &SplitInput) -> Self {
        Self {
            recipient: value.recipient,
            bps: value.bps,
            category: value.category,
            accrued: 0,
            released: 0,
        }
    }
}
#[event]
pub struct RouterLocked {
    pub router: Pubkey,
}
#[event]
pub struct Synced {
    pub router: Pubkey,
    pub amount: u64,
}
#[event]
pub struct Released {
    pub router: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}
#[error_code]
pub enum FeeError {
    #[msg("Already locked")]
    AlreadyLocked,
    #[msg("No splits")]
    NoSplits,
    #[msg("Bps must total denominator")]
    BpsMustTotalDenominator,
    #[msg("Zero recipient")]
    ZeroRecipient,
    #[msg("Zero bps")]
    ZeroBps,
    #[msg("Duplicate recipient")]
    DuplicateRecipient,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Bounds exceeded")]
    BoundsExceeded,
    #[msg("Not ready")]
    NotReady,
    #[msg("Insolvent")]
    Insolvent,
    #[msg("Canonical token transfer adapter required")]
    TokenTransferAdapterRequired,
}
