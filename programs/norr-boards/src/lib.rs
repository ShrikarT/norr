#![allow(deprecated, unexpected_cfgs)]

use anchor_lang::prelude::*;

declare_id!("2CfmqDruJHpAqManNjNAfEhCX99NhBAkmCQ73Tt5FXvY");

pub const MAX_PARTNER_BPS: u16 = 5_000;
pub const NORR_LAUNCH_ID: Pubkey =
    anchor_lang::solana_program::pubkey!("4cpxPRvPm974bLKMJa8TfYyvzuFeQ9sjtFJkz3EhJ4p8");

#[program]
pub mod norr_boards {
    use super::*;

    pub fn create_board(
        ctx: Context<CreateBoard>,
        slug: String,
        name: String,
        uri: String,
        min_bps: u16,
        allowlist_only: bool,
    ) -> Result<()> {
        require!(!slug.is_empty() && !name.is_empty(), BoardError::EmptyField);
        require!(slug.len() <= 32, BoardError::SlugTooLong);
        validate_metadata(&name, &uri)?;
        validate_min_bps(min_bps)?;

        let board = &mut ctx.accounts.board;
        board.owner = ctx.accounts.owner.key();
        board.min_bps = min_bps;
        board.launch_count = 0;
        board.created_at = Clock::get()?.unix_timestamp;
        board.allowlist_only = allowlist_only;
        board.slug = slug;
        board.name = name;
        board.uri = uri;
        board.bump = ctx.bumps.board;

        emit!(BoardCreated {
            board: board.key(),
            owner: board.owner,
            min_bps,
            allowlist_only,
        });
        Ok(())
    }

    pub fn update_board(ctx: Context<UpdateBoard>, name: String, uri: String) -> Result<()> {
        validate_metadata(&name, &uri)?;
        ctx.accounts.board.name = name;
        ctx.accounts.board.uri = uri;
        emit!(BoardUpdated {
            board: ctx.accounts.board.key(),
        });
        Ok(())
    }

    pub fn set_min_bps(ctx: Context<UpdateBoard>, min_bps: u16) -> Result<()> {
        validate_min_bps(min_bps)?;
        ctx.accounts.board.min_bps = min_bps;
        emit!(BoardMinBpsSet {
            board: ctx.accounts.board.key(),
            min_bps,
        });
        Ok(())
    }

    pub fn set_allowlist_only(ctx: Context<UpdateBoard>, allowlist_only: bool) -> Result<()> {
        ctx.accounts.board.allowlist_only = allowlist_only;
        emit!(BoardAllowlistModeSet {
            board: ctx.accounts.board.key(),
            allowlist_only,
        });
        Ok(())
    }

    pub fn allow_creator(ctx: Context<AllowCreator>, creator: Pubkey) -> Result<()> {
        require!(creator != Pubkey::default(), BoardError::ZeroAddress);
        let allowlist = &mut ctx.accounts.allowlist;
        allowlist.board = ctx.accounts.board.key();
        allowlist.creator = creator;
        allowlist.bump = ctx.bumps.allowlist;
        emit!(CreatorAllowed {
            board: allowlist.board,
            creator,
        });
        Ok(())
    }

    pub fn disallow_creator(ctx: Context<DisallowCreator>) -> Result<()> {
        emit!(CreatorDisallowed {
            board: ctx.accounts.board.key(),
            creator: ctx.accounts.allowlist.creator,
        });
        Ok(())
    }

    pub fn register_launch(ctx: Context<RegisterLaunch>) -> Result<()> {
        let board = &mut ctx.accounts.board;
        board.launch_count = board
            .launch_count
            .checked_add(1)
            .ok_or(BoardError::MathOverflow)?;
        emit!(LaunchRegistered {
            board: board.key(),
            launch: ctx.accounts.launch.key(),
            launch_count: board.launch_count,
        });
        Ok(())
    }
}

fn validate_metadata(name: &str, uri: &str) -> Result<()> {
    require!(!name.is_empty(), BoardError::EmptyField);
    require!(
        name.len() <= 64 && uri.len() <= 200,
        BoardError::BoundsExceeded
    );
    Ok(())
}

fn validate_min_bps(min_bps: u16) -> Result<()> {
    require!(min_bps <= MAX_PARTNER_BPS, BoardError::ShareTooHigh);
    Ok(())
}

#[derive(Accounts)]
#[instruction(slug: String)]
pub struct CreateBoard<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = Board::LEN,
        seeds = [b"board", slug.as_bytes()],
        bump
    )]
    pub board: Account<'info, Board>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateBoard<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"board", board.slug.as_bytes()],
        bump = board.bump,
        has_one = owner @ BoardError::NotBoardOwner
    )]
    pub board: Account<'info, Board>,
}

#[derive(Accounts)]
#[instruction(creator: Pubkey)]
pub struct AllowCreator<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        seeds = [b"board", board.slug.as_bytes()],
        bump = board.bump,
        has_one = owner @ BoardError::NotBoardOwner
    )]
    pub board: Account<'info, Board>,
    #[account(
        init,
        payer = owner,
        space = Allowlist::LEN,
        seeds = [b"allow", board.key().as_ref(), creator.as_ref()],
        bump
    )]
    pub allowlist: Account<'info, Allowlist>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DisallowCreator<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        seeds = [b"board", board.slug.as_bytes()],
        bump = board.bump,
        has_one = owner @ BoardError::NotBoardOwner
    )]
    pub board: Account<'info, Board>,
    #[account(
        mut,
        close = owner,
        seeds = [b"allow", board.key().as_ref(), allowlist.creator.as_ref()],
        bump = allowlist.bump,
        has_one = board
    )]
    pub allowlist: Account<'info, Allowlist>,
}

#[derive(Accounts)]
pub struct RegisterLaunch<'info> {
    #[account(owner = NORR_LAUNCH_ID)]
    pub launch: Signer<'info>,
    #[account(
        mut,
        seeds = [b"board", board.slug.as_bytes()],
        bump = board.bump
    )]
    pub board: Account<'info, Board>,
}

#[account]
pub struct Board {
    pub owner: Pubkey,
    pub min_bps: u16,
    pub launch_count: u32,
    pub created_at: i64,
    pub allowlist_only: bool,
    pub slug: String,
    pub name: String,
    pub uri: String,
    pub bump: u8,
}

impl Board {
    // discriminator + fixed fields + bounded strings + bump
    pub const LEN: usize = 8 + 32 + 2 + 4 + 8 + 1 + (4 + 32) + (4 + 64) + (4 + 200) + 1;
}

#[account]
pub struct Allowlist {
    pub board: Pubkey,
    pub creator: Pubkey,
    pub bump: u8,
}

impl Allowlist {
    pub const LEN: usize = 8 + 32 + 32 + 1;
}

#[event]
pub struct BoardCreated {
    pub board: Pubkey,
    pub owner: Pubkey,
    pub min_bps: u16,
    pub allowlist_only: bool,
}

#[event]
pub struct BoardUpdated {
    pub board: Pubkey,
}

#[event]
pub struct BoardMinBpsSet {
    pub board: Pubkey,
    pub min_bps: u16,
}

#[event]
pub struct BoardAllowlistModeSet {
    pub board: Pubkey,
    pub allowlist_only: bool,
}

#[event]
pub struct CreatorAllowed {
    pub board: Pubkey,
    pub creator: Pubkey,
}

#[event]
pub struct CreatorDisallowed {
    pub board: Pubkey,
    pub creator: Pubkey,
}

#[event]
pub struct LaunchRegistered {
    pub board: Pubkey,
    pub launch: Pubkey,
    pub launch_count: u32,
}

#[error_code]
pub enum BoardError {
    #[msg("Empty field")]
    EmptyField,
    #[msg("Slug too long")]
    SlugTooLong,
    #[msg("Share too high")]
    ShareTooHigh,
    #[msg("Not board owner")]
    NotBoardOwner,
    #[msg("Zero address")]
    ZeroAddress,
    #[msg("Bounds exceeded")]
    BoundsExceeded,
    #[msg("Math overflow")]
    MathOverflow,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn board_account_size_covers_maximum_values() {
        let board = Board {
            owner: Pubkey::new_unique(),
            min_bps: MAX_PARTNER_BPS,
            launch_count: u32::MAX,
            created_at: i64::MAX,
            allowlist_only: true,
            slug: "s".repeat(32),
            name: "n".repeat(64),
            uri: "u".repeat(200),
            bump: u8::MAX,
        };
        let serialized = board.try_to_vec().unwrap();
        assert_eq!(8 + serialized.len(), Board::LEN);
    }

    #[test]
    fn allowlist_account_size_is_exact() {
        let allowlist = Allowlist {
            board: Pubkey::new_unique(),
            creator: Pubkey::new_unique(),
            bump: u8::MAX,
        };
        let serialized = allowlist.try_to_vec().unwrap();
        assert_eq!(8 + serialized.len(), Allowlist::LEN);
    }
}
