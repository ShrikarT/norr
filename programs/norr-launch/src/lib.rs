#![allow(
    deprecated,
    unexpected_cfgs,
    clippy::needless_as_bytes,
    clippy::needless_range_loop
)]
use anchor_lang::prelude::*;
declare_id!("4orq3YjidamefZgGufp6uSpdgxdxpNeCfdy6spZas2cE");

pub const ACTIVE: u8 = 1;
pub const SPLIT_LOCKED: u8 = 1 << 3;
pub const BOARD_SPLIT_CATEGORY: u8 = 1;

#[program]
pub mod norr_launch {
    use super::*;

    pub fn create(ctx: Context<Create>, args: CreateArgs) -> Result<()> {
        require!(args.model <= 1, LaunchError::OutOfRange);
        require!(
            !args.name.is_empty() && !args.symbol.is_empty(),
            LaunchError::EmptyField
        );
        require!(args.name.len() <= 64, LaunchError::BoundsExceeded);
        require!(args.symbol.len() <= 16, LaunchError::BoundsExceeded);
        validate_uri(&args.uri)?;
        let launch = &mut ctx.accounts.launch;
        launch.creator = ctx.accounts.creator.key();
        launch.board = Pubkey::default();
        launch.project_mint = args.project_mint;
        launch.contribution_mint = args.contribution_mint;
        launch.sale = args.sale;
        launch.router = args.router;
        launch.curve = args.curve;
        launch.model = args.model;
        launch.created_at = Clock::get()?.unix_timestamp;
        launch.flags = 0;
        launch.metadata_hash = args.metadata_hash;
        launch.name = args.name;
        launch.symbol = args.symbol;
        launch.uri = args.uri;
        launch.bump = ctx.bumps.launch;
        emit!(LaunchCreated {
            launch: launch.key(),
            creator: launch.creator,
            model: launch.model
        });
        Ok(())
    }

    pub fn attach_board(ctx: Context<AttachBoard>) -> Result<()> {
        let launch = &ctx.accounts.launch;
        require!(launch.flags & ACTIVE == 0, LaunchError::AlreadyFinalized);
        require!(
            launch.board == Pubkey::default(),
            LaunchError::AlreadyRegistered
        );

        let board = &ctx.accounts.board;
        let board_key = board.key();
        let board_owner = board.owner;
        let board_min_bps = board.min_bps;
        let creator = ctx.accounts.creator.key();
        let allowlist_matches = ctx.accounts.allowlist.as_ref().is_some_and(|allowlist| {
            creator_is_allowed(board_key, creator, allowlist.key(), allowlist)
        });
        require!(
            !board.allowlist_only || allowlist_matches,
            LaunchError::NotAllowedOnBoard
        );

        let router = &ctx.accounts.router;
        let board_split_matches = has_board_split(router, board_owner, board_min_bps)?;
        require!(board_split_matches, LaunchError::BoardShareTooLow);
        require!(router.total_received == 0, LaunchError::AlreadyFinalized);

        let project_mint = launch.project_mint;
        let launch_bump = [launch.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[b"launch", project_mint.as_ref(), &launch_bump]];
        let cpi_accounts = norr_boards::cpi::accounts::RegisterLaunch {
            launch: ctx.accounts.launch.to_account_info(),
            board: ctx.accounts.board.to_account_info(),
        };
        norr_boards::cpi::register_launch(CpiContext::new_with_signer(
            ctx.accounts.boards_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        ))?;

        let launch = &mut ctx.accounts.launch;
        launch.board = board_key;
        emit!(BoardAttached {
            launch: launch.key(),
            board: board_key,
            board_owner,
            min_bps: board_min_bps,
        });
        Ok(())
    }

    pub fn set_uri(ctx: Context<Configure>, uri: String, metadata_hash: [u8; 32]) -> Result<()> {
        require!(
            ctx.accounts.launch.flags & ACTIVE == 0,
            LaunchError::AlreadyFinalized
        );
        validate_uri(&uri)?;
        ctx.accounts.launch.uri = uri;
        ctx.accounts.launch.metadata_hash = metadata_hash;
        Ok(())
    }

    pub fn activate(ctx: Context<Activate>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        require!(launch.flags & ACTIVE == 0, LaunchError::AlreadyFinalized);

        if launch.model == 1 {
            require!(
                ctx.accounts.sale.key() == launch.sale,
                LaunchError::ActivationChecklistRequired
            );
            let sale_data = ctx.accounts.sale.try_borrow_data()?;
            let mut data_slice: &[u8] = &sale_data;
            let sale_account = norr_claim::Sale::try_deserialize(&mut data_slice)
                .map_err(|_| LaunchError::ActivationChecklistRequired)?;

            require!(
                sale_account.ends_at > sale_account.starts_at,
                LaunchError::ActivationChecklistRequired
            );
            require!(
                sale_account
                    .ends_at
                    .checked_sub(sale_account.starts_at)
                    .unwrap()
                    <= 30 * 86400,
                LaunchError::ActivationChecklistRequired
            );
            require!(
                sale_account.launch == launch.key(),
                LaunchError::ActivationChecklistRequired
            );
            require!(
                sale_account.settlement_deadline > sale_account.ends_at,
                LaunchError::ActivationChecklistRequired
            );
        }

        launch.flags |= ACTIVE;
        emit!(LaunchActivated {
            launch: launch.key()
        });
        Ok(())
    }
}

fn validate_uri(uri: &str) -> Result<()> {
    require!(
        !uri.is_empty() && uri.len() <= 200,
        LaunchError::BoundsExceeded
    );
    require!(!uri.starts_with("data:"), LaunchError::UnsupportedUri);
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateArgs {
    pub project_mint: Pubkey,
    pub contribution_mint: Pubkey,
    pub sale: Pubkey,
    pub router: Pubkey,
    pub curve: Pubkey,
    pub model: u8,
    pub metadata_hash: [u8; 32],
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

#[derive(Accounts)]
#[instruction(args: CreateArgs)]
pub struct Create<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = Launch::LEN,
        seeds = [b"launch", args.project_mint.as_ref()],
        bump
    )]
    pub launch: Account<'info, Launch>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Activate<'info> {
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [b"launch", launch.project_mint.as_ref()],
        bump = launch.bump,
        has_one = creator
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        constraint = project_mint.key() == launch.project_mint,
        constraint = project_mint.decimals == 9,
        constraint = project_mint.supply == 1_000_000_000_000_000_000,
        constraint = project_mint.mint_authority.is_none(),
        constraint = project_mint.freeze_authority.is_none(),
    )]
    pub project_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(
        constraint = router.key() == launch.router,
        constraint = router.locked,
        constraint = router.total_released == 0,
    )]
    pub router: Account<'info, norr_fees::Router>,

    #[account(
        constraint = curve.key() == launch.curve,
        constraint = curve.fee_bps <= 1_000,
        constraint = curve.liquidity_unlock_at >= Clock::get()?.unix_timestamp + 15_552_000,
    )]
    pub curve: Account<'info, norr_market::Curve>,

    /// CHECK: Validated manually if model == 1
    pub sale: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Configure<'info> {
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [b"launch", launch.project_mint.as_ref()],
        bump = launch.bump,
        has_one = creator
    )]
    pub launch: Account<'info, Launch>,
}

fn creator_is_allowed(
    board: Pubkey,
    creator: Pubkey,
    allowlist_key: Pubkey,
    allowlist: &norr_boards::Allowlist,
) -> bool {
    let expected = Pubkey::find_program_address(
        &[b"allow", board.as_ref(), creator.as_ref()],
        &norr_boards::ID,
    )
    .0;
    allowlist_key == expected && allowlist.board == board && allowlist.creator == creator
}

fn has_board_split(router: &norr_fees::Router, board_owner: Pubkey, min_bps: u16) -> Result<bool> {
    let splits = router
        .splits
        .get(..usize::from(router.split_count))
        .ok_or(LaunchError::BoundsExceeded)?;
    Ok(splits.iter().any(|split| {
        split.category == BOARD_SPLIT_CATEGORY
            && split.recipient == board_owner
            && split.bps >= min_bps
    }))
}

#[derive(Accounts)]
pub struct AttachBoard<'info> {
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [b"launch", launch.project_mint.as_ref()],
        bump = launch.bump,
        has_one = creator
    )]
    pub launch: Account<'info, Launch>,
    #[account(
        mut,
        seeds = [b"board", board.slug.as_bytes()],
        bump = board.bump,
        seeds::program = norr_boards::ID
    )]
    pub board: Account<'info, norr_boards::Board>,
    pub allowlist: Option<Account<'info, norr_boards::Allowlist>>,
    #[account(
        seeds = [b"router", launch.key().as_ref()],
        bump = router.bump,
        seeds::program = norr_fees::ID,
        address = launch.router,
        constraint = router.launch == launch.key()
    )]
    pub router: Account<'info, norr_fees::Router>,
    pub boards_program: Program<'info, norr_boards::program::NorrBoards>,
}

#[account]
pub struct Launch {
    pub creator: Pubkey,
    pub board: Pubkey,
    pub project_mint: Pubkey,
    pub contribution_mint: Pubkey,
    pub sale: Pubkey,
    pub router: Pubkey,
    pub curve: Pubkey,
    pub model: u8,
    pub created_at: i64,
    pub flags: u8,
    pub metadata_hash: [u8; 32],
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub bump: u8,
}
impl Launch {
    pub const LEN: usize = 8 + 32 * 7 + 1 + 8 + 1 + 32 + (4 + 64) + (4 + 16) + (4 + 200) + 1;
}

#[event]
pub struct LaunchCreated {
    pub launch: Pubkey,
    pub creator: Pubkey,
    pub model: u8,
}
#[event]
pub struct BoardAttached {
    pub launch: Pubkey,
    pub board: Pubkey,
    pub board_owner: Pubkey,
    pub min_bps: u16,
}
#[event]
pub struct LaunchActivated {
    pub launch: Pubkey,
}

#[error_code]
pub enum LaunchError {
    #[msg("Already finalized")]
    AlreadyFinalized,
    #[msg("Already registered")]
    AlreadyRegistered,
    #[msg("Empty field")]
    EmptyField,
    #[msg("Out of range")]
    OutOfRange,
    #[msg("Bounds exceeded")]
    BoundsExceeded,
    #[msg("Data URIs are not accepted")]
    UnsupportedUri,
    #[msg("Creator is not allowed on board")]
    NotAllowedOnBoard,
    #[msg("Board split is missing or below the minimum share")]
    BoardShareTooLow,
    #[msg("Full on-chain activation checklist and CPI adapters required")]
    ActivationChecklistRequired,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn router_with_split(recipient: Pubkey, bps: u16, category: u8) -> norr_fees::Router {
        let mut splits = [norr_fees::Split::default(); 8];
        splits[0] = norr_fees::Split {
            recipient,
            bps,
            category,
            accrued: 0,
            released: 0,
        };
        norr_fees::Router {
            launch: Pubkey::new_unique(),
            authority: Pubkey::new_unique(),
            asset_mint: Pubkey::new_unique(),
            vault: Pubkey::new_unique(),
            total_received: 0,
            total_released: 0,
            locked: false,
            split_count: 1,
            splits,
            bump: 1,
        }
    }

    #[test]
    fn allowlist_is_bound_to_board_and_creator() {
        let board = Pubkey::new_unique();
        let creator = Pubkey::new_unique();
        let allowlist = norr_boards::Allowlist {
            board,
            creator,
            bump: 1,
        };
        let key = Pubkey::find_program_address(
            &[b"allow", board.as_ref(), creator.as_ref()],
            &norr_boards::ID,
        )
        .0;
        assert!(creator_is_allowed(board, creator, key, &allowlist));
        assert!(!creator_is_allowed(
            Pubkey::new_unique(),
            creator,
            key,
            &allowlist
        ));
        assert!(!creator_is_allowed(
            board,
            Pubkey::new_unique(),
            key,
            &allowlist
        ));
        assert!(!creator_is_allowed(
            board,
            creator,
            Pubkey::new_unique(),
            &allowlist
        ));
    }

    #[test]
    fn board_split_requires_owner_category_and_minimum() {
        let owner = Pubkey::new_unique();
        assert!(has_board_split(&router_with_split(owner, 1_500, 1), owner, 1_500).unwrap());
        assert!(!has_board_split(&router_with_split(owner, 1_499, 1), owner, 1_500).unwrap());
        assert!(!has_board_split(&router_with_split(owner, 1_500, 0), owner, 1_500).unwrap());
        assert!(!has_board_split(
            &router_with_split(Pubkey::new_unique(), 1_500, 1),
            owner,
            1_500
        )
        .unwrap());
    }

    #[test]
    fn corrupt_split_count_fails_closed() {
        let owner = Pubkey::new_unique();
        let mut router = router_with_split(owner, 1_500, 1);
        router.split_count = 9;
        assert!(has_board_split(&router, owner, 1_500).is_err());
    }
}
