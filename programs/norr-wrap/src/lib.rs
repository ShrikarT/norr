#![allow(
    deprecated,
    unexpected_cfgs,
    clippy::needless_as_bytes,
    clippy::needless_range_loop
)]
use anchor_lang::prelude::*;
declare_id!("9qLPCBzMENxbTVvFQCACtfD9DnY1KBhz3WFqMzc8u7LU");
#[program]
pub mod norr_wrap {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.underlying_mint = args.underlying_mint;
        config.confidential_mint = args.confidential_mint;
        config.underlying_token_program = args.underlying_token_program;
        config.vault = args.vault;
        config.authority = ctx.accounts.authority.key();
        config.ct_mint_authority = args.ct_mint_authority;
        config.excess_recipient = args.excess_recipient;
        config.auditor_elgamal_pubkey = args.auditor_elgamal_pubkey;
        config.auditor_epoch = 0;
        config.total_liability = 0;
        config.paused = false;
        config.bump = ctx.bumps.config;
        Ok(())
    }
    pub fn wrap(_ctx: Context<Operate>, _amount: u64) -> Result<()> {
        err!(WrapError::P0Required)
    }
    pub fn unwrap(_ctx: Context<Operate>, _amount: u64) -> Result<()> {
        err!(WrapError::P0Required)
    }
    pub fn rotate_auditor(ctx: Context<Configure>, key: [u8; 32]) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.auditor_elgamal_pubkey = key;
        config.auditor_epoch = config.auditor_epoch.checked_add(1).unwrap();
        Ok(())
    }
    pub fn set_paused(ctx: Context<Configure>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        Ok(())
    }
    pub fn recover_excess(_ctx: Context<Operate>) -> Result<()> {
        err!(WrapError::P0Required)
    }
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeArgs {
    pub underlying_mint: Pubkey,
    pub confidential_mint: Pubkey,
    pub underlying_token_program: Pubkey,
    pub vault: Pubkey,
    pub ct_mint_authority: Pubkey,
    pub excess_recipient: Pubkey,
    pub auditor_elgamal_pubkey: [u8; 32],
}
#[derive(Accounts)]
#[instruction(args:InitializeArgs)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init,payer=authority,space=WrapConfig::LEN,seeds=[b"cmint",args.underlying_mint.as_ref()],bump)]
    pub config: Account<'info, WrapConfig>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Operate<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(mut,seeds=[b"cmint",config.underlying_mint.as_ref()],bump=config.bump)]
    pub config: Account<'info, WrapConfig>,
}
#[derive(Accounts)]
pub struct Configure<'info> {
    pub authority: Signer<'info>,
    #[account(mut,has_one=authority)]
    pub config: Account<'info, WrapConfig>,
}
#[account]
pub struct WrapConfig {
    pub underlying_mint: Pubkey,
    pub confidential_mint: Pubkey,
    pub underlying_token_program: Pubkey,
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub ct_mint_authority: Pubkey,
    pub excess_recipient: Pubkey,
    pub auditor_elgamal_pubkey: [u8; 32],
    pub auditor_epoch: u32,
    pub total_liability: u64,
    pub paused: bool,
    pub bump: u8,
}
impl WrapConfig {
    pub const LEN: usize = 8 + 32 * 7 + 32 + 4 + 8 + 1 + 1;
}
#[error_code]
pub enum WrapError {
    #[msg("P0 target-cluster confidential-transfer gate required")]
    P0Required,
}
