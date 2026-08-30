#![allow(deprecated, clippy::too_many_arguments, unexpected_cfgs)]
use anchor_lang::prelude::*;

declare_id!("C1aim11111111111111111111111111111111111111");

pub mod state {
    pub const ACCEPTING: u8 = 0;
    pub const ALLOCATION_COMMITTED: u8 = 1;
    pub const CLAIMS_OPEN: u8 = 2;
    pub const REFUNDS_OPEN: u8 = 3;
}

#[program]
pub mod norr_claim {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        project_mint: Pubkey,
        contribution_mint: Pubkey,
        router: Pubkey,
        wrap_config: Pubkey,
        settlement_mint: Pubkey,
        starts_at: i64,
        ends_at: i64,
        tally_authority: Pubkey,
        emergency_authority: Pubkey,
    ) -> Result<()> {
        let s = &mut ctx.accounts.sale;
        s.launch = ctx.accounts.launch.key();
        s.tally_authority = tally_authority;
        s.emergency_authority = emergency_authority;
        s.project_mint = project_mint;
        s.contribution_mint = contribution_mint;
        s.router = router;
        s.wrap_config = wrap_config;
        s.settlement_mint = settlement_mint;
        s.starts_at = starts_at;
        s.ends_at = ends_at;
        s.state = state::ACCEPTING;
        s.bump = ctx.bumps.sale;
        Ok(())
    }

    pub fn configure(
        ctx: Context<Configure>,
        vault: Pubkey,
        token_vault: Pubkey,
        settlement_vault: Pubkey,
    ) -> Result<()> {
        let s = &mut ctx.accounts.sale;
        s.vault = vault;
        s.token_vault = token_vault;
        s.settlement_vault = settlement_vault;
        Ok(())
    }

    pub fn contribute(_ctx: Context<Configure>, _context_hash: [u8; 32]) -> Result<()> {
        err!(ClaimError::P0Required)
    }

    pub fn apply_pending(_ctx: Context<Configure>) -> Result<()> {
        err!(ClaimError::P0Required)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn finalize(
        ctx: Context<Finalize>,
        root: [u8; 32],
        manifest_hash: [u8; 32],
        _chain_hash: [u8; 32],
        _count: u32,
        total_contributed: u64,
        total_allocated: u64,
        claimant_count: u32,
    ) -> Result<()> {
        let s = &mut ctx.accounts.sale;
        require!(s.state == state::ACCEPTING, ClaimError::NotReady);
        require!(s.settled_amount == 0, ClaimError::NotReady);

        s.merkle_root = root;
        s.tally_manifest_hash = manifest_hash;
        s.total_contributed = total_contributed;
        s.total_allocated = total_allocated;
        s.claimant_count = claimant_count;
        s.tally_revision = s
            .tally_revision
            .checked_add(1)
            .ok_or(ClaimError::MathOverflow)?;
        s.state = state::ALLOCATION_COMMITTED;
        Ok(())
    }

    pub fn fund(ctx: Context<Fund>, amount: u64) -> Result<()> {
        let s = &mut ctx.accounts.sale;
        require!(
            s.state == state::ALLOCATION_COMMITTED || s.state == state::CLAIMS_OPEN,
            ClaimError::NotReady
        );

        let ix = anchor_spl::token::Transfer {
            from: ctx.accounts.funder_vault.to_account_info(),
            to: ctx.accounts.token_vault.to_account_info(),
            authority: ctx.accounts.funder.to_account_info(),
        };
        anchor_spl::token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), ix),
            amount,
        )?;

        ctx.accounts.token_vault.reload()?;
        if s.state == state::ALLOCATION_COMMITTED
            && ctx.accounts.token_vault.amount >= s.total_allocated
        {
            s.state = state::CLAIMS_OPEN;
        }
        Ok(())
    }

    pub fn settle(_ctx: Context<Configure>, _amount: u64) -> Result<()> {
        err!(ClaimError::P0Required)
    }

    pub fn commit_refund(
        ctx: Context<CommitRefund>,
        root: [u8; 32],
        total_contributed: u64,
    ) -> Result<()> {
        let s = &mut ctx.accounts.sale;
        require!(
            s.state != state::REFUNDS_OPEN && s.state != state::CLAIMS_OPEN,
            ClaimError::NotReady
        );
        require!(
            Clock::get()?.unix_timestamp >= s.settlement_deadline,
            ClaimError::NotReady
        );
        require!(s.settled_amount == 0, ClaimError::NotReady);

        s.merkle_root = root;
        s.total_contributed = total_contributed;
        s.total_allocated = total_contributed;
        s.tally_revision = s
            .tally_revision
            .checked_add(1)
            .ok_or(ClaimError::MathOverflow)?;
        s.state = state::REFUNDS_OPEN;
        Ok(())
    }

    pub fn settle_refund(_ctx: Context<Configure>, _amount: u64) -> Result<()> {
        err!(ClaimError::P0Required)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn open_claim(
        ctx: Context<OpenClaim>,
        allocation: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let s = &ctx.accounts.sale;
        require!(
            s.state == state::CLAIMS_OPEN || s.state == state::REFUNDS_OPEN,
            ClaimError::NotReady
        );
        let mint = if s.state == state::CLAIMS_OPEN {
            s.project_mint
        } else {
            s.settlement_mint
        };
        let domain = if s.state == state::CLAIMS_OPEN {
            b"norr-claim-v1".as_slice()
        } else {
            b"norr-refund-v1".as_slice()
        };
        let amount = allocation.to_le_bytes();
        let inner = anchor_lang::solana_program::keccak::hashv(&[
            domain,
            crate::ID.as_ref(),
            s.key().as_ref(),
            mint.as_ref(),
            ctx.accounts.claimant.key().as_ref(),
            &amount,
        ])
        .0;
        let mut node = anchor_lang::solana_program::keccak::hash(&inner).0;
        for sibling in proof {
            node = if node <= sibling {
                anchor_lang::solana_program::keccak::hashv(&[&node, &sibling]).0
            } else {
                anchor_lang::solana_program::keccak::hashv(&[&sibling, &node]).0
            };
        }
        require!(node == s.merkle_root, ClaimError::InvalidProof);
        let c = &mut ctx.accounts.claim_status;
        c.sale = s.key();
        c.claimant = ctx.accounts.claimant.key();
        c.allocation = allocation;
        c.claimed = 0;
        c.bump = ctx.bumps.claim_status;
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let s = &mut ctx.accounts.sale;
        require!(
            s.state == state::CLAIMS_OPEN || s.state == state::REFUNDS_OPEN,
            ClaimError::NotReady
        );

        let c = &mut ctx.accounts.claim_status;
        require!(c.claimed == 0, ClaimError::AlreadyClaimed);

        let amount = c.allocation;
        c.claimed = amount;

        s.total_claimed = s
            .total_claimed
            .checked_add(amount)
            .ok_or(ClaimError::MathOverflow)?;

        let seeds = &[b"sale", s.launch.as_ref(), &[s.bump]];
        let signer = &[&seeds[..]];

        let ix = anchor_spl::token::Transfer {
            from: ctx.accounts.token_vault.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: s.to_account_info(),
        };
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), ix, signer),
            amount,
        )?;

        Ok(())
    }

    pub fn close_claim_status(ctx: Context<CloseClaimStatus>) -> Result<()> {
        require!(ctx.accounts.claim_status.claimed > 0, ClaimError::NotReady);
        Ok(())
    }

    pub fn close_sale(ctx: Context<CloseSale>) -> Result<()> {
        let s = &ctx.accounts.sale;
        require!(s.total_claimed == s.total_allocated, ClaimError::NotReady);
        Ok(())
    }
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeArgs {
    pub tally_authority: Pubkey,
    pub emergency_authority: Pubkey,
    pub project_mint: Pubkey,
    pub contribution_mint: Pubkey,
    pub vault: Pubkey,
    pub token_vault: Pubkey,
    pub router: Pubkey,
    pub wrap_config: Pubkey,
    pub settlement_mint: Pubkey,
    pub settlement_vault: Pubkey,
    pub starts_at: i64,
    pub ends_at: i64,
}
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: deterministic Launch PDA.
    pub launch: UncheckedAccount<'info>,
    #[account(init,payer=payer,space=Sale::LEN,seeds=[b"sale",launch.key().as_ref()],bump)]
    pub sale: Account<'info, Sale>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Configure<'info> {
    #[account(mut,seeds=[b"sale",sale.launch.as_ref()],bump=sale.bump)]
    pub sale: Account<'info, Sale>,
}
#[derive(Accounts)]
pub struct OpenClaim<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,
    #[account(seeds=[b"sale",sale.launch.as_ref()],bump=sale.bump)]
    pub sale: Account<'info, Sale>,
    #[account(init,payer=claimant,space=ClaimStatus::LEN,seeds=[b"claim",sale.key().as_ref(),claimant.key().as_ref()],bump)]
    pub claim_status: Account<'info, ClaimStatus>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Finalize<'info> {
    pub tally_authority: Signer<'info>,
    #[account(mut, seeds=[b"sale", sale.launch.as_ref()], bump=sale.bump, has_one=tally_authority)]
    pub sale: Account<'info, Sale>,
}

#[derive(Accounts)]
pub struct CommitRefund<'info> {
    pub emergency_authority: Signer<'info>,
    #[account(mut, seeds=[b"sale", sale.launch.as_ref()], bump=sale.bump, has_one=emergency_authority)]
    pub sale: Account<'info, Sale>,
}

#[derive(Accounts)]
pub struct Fund<'info> {
    pub funder: Signer<'info>,
    #[account(mut, seeds=[b"sale", sale.launch.as_ref()], bump=sale.bump)]
    pub sale: Account<'info, Sale>,
    #[account(mut, constraint=token_vault.key() == sale.token_vault)]
    pub token_vault: Account<'info, anchor_spl::token::TokenAccount>,
    #[account(mut)]
    pub funder_vault: Account<'info, anchor_spl::token::TokenAccount>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub claimant: Signer<'info>,
    #[account(mut, seeds=[b"sale", sale.launch.as_ref()], bump=sale.bump)]
    pub sale: Account<'info, Sale>,
    #[account(mut, seeds=[b"claim", sale.key().as_ref(), claimant.key().as_ref()], bump=claim_status.bump, has_one=claimant, has_one=sale)]
    pub claim_status: Account<'info, ClaimStatus>,
    #[account(mut, constraint=token_vault.key() == sale.token_vault)]
    pub token_vault: Account<'info, anchor_spl::token::TokenAccount>,
    #[account(mut)]
    pub destination: Account<'info, anchor_spl::token::TokenAccount>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
}

#[derive(Accounts)]
pub struct CloseClaimStatus<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,
    #[account(mut, close=claimant, seeds=[b"claim", claim_status.sale.as_ref(), claimant.key().as_ref()], bump=claim_status.bump, has_one=claimant)]
    pub claim_status: Account<'info, ClaimStatus>,
}

#[derive(Accounts)]
pub struct CloseSale<'info> {
    #[account(mut)]
    pub receiver: Signer<'info>,
    #[account(mut, close=receiver, seeds=[b"sale", sale.launch.as_ref()], bump=sale.bump)]
    pub sale: Account<'info, Sale>,
    #[account(constraint=token_vault.amount == 0 && token_vault.key() == sale.token_vault)]
    pub token_vault: Account<'info, anchor_spl::token::TokenAccount>,
}

#[account]
pub struct Sale {
    pub launch: Pubkey,
    pub tally_authority: Pubkey,
    pub emergency_authority: Pubkey,
    pub project_mint: Pubkey,
    pub contribution_mint: Pubkey,
    pub vault: Pubkey,
    pub token_vault: Pubkey,
    pub router: Pubkey,
    pub wrap_config: Pubkey,
    pub settlement_mint: Pubkey,
    pub settlement_vault: Pubkey,
    pub starts_at: i64,
    pub ends_at: i64,
    pub merkle_root: [u8; 32],
    pub tally_manifest_hash: [u8; 32],
    pub contribution_chain_hash: [u8; 32],
    pub settlement_not_before: i64,
    pub settlement_deadline: i64,
    pub total_contributed: u64,
    pub total_allocated: u64,
    pub total_claimed: u64,
    pub settled_amount: u64,
    pub contribution_count: u32,
    pub claimant_count: u32,
    pub tally_revision: u32,
    pub state: u8,
    pub bump: u8,
}
impl Sale {
    pub const LEN: usize = 8 + 32 * 11 + 8 * 2 + 32 * 3 + 8 * 2 + 8 * 4 + 4 * 3 + 1 + 1;
}
#[account]
pub struct ClaimStatus {
    pub sale: Pubkey,
    pub claimant: Pubkey,
    pub allocation: u64,
    pub claimed: u64,
    pub bump: u8,
}
impl ClaimStatus {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}
#[error_code]
pub enum ClaimError {
    #[msg("Invalid proof")]
    InvalidProof,
    #[msg("Not ready")]
    NotReady,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Bounds exceeded")]
    BoundsExceeded,
    #[msg("P0 target-cluster confidential-transfer gate required")]
    P0Required,
    #[msg("Contribution sequence mismatch")]
    ContributionSequenceMismatch,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Vault not empty")]
    VaultNotEmpty,
}
