from pathlib import Path
import json, textwrap
root=Path(__file__).resolve().parents[1]
ids=json.loads((root/'program-ids.json').read_text())

def put(path,text):
 p=root/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(textwrap.dedent(text).lstrip())

def cargo(name,features=''):
 hy=name.replace('_','-')
 put(f'programs/{hy}/Cargo.toml',f'''[package]
name = "{hy}"
version.workspace = true
edition.workspace = true
license.workspace = true

[lib]
crate-type = ["cdylib", "lib"]
name = "{name}"

[features]
default = []
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
{features}

[dependencies]
anchor-lang.workspace = true
anchor-spl.workspace = true
''')

for name in ids: cargo(name)
cargo('norr_claim','p0-verified = []')
cargo('norr_wrap','p0-verified = []')
cargo('norr_market','damm-v2 = []')

put('programs/norr-launch/src/lib.rs',f'''
use anchor_lang::prelude::*;
declare_id!("{ids['norr_launch']}");

pub const ACTIVE: u8 = 1;
pub const SPLIT_LOCKED: u8 = 1 << 3;

#[program]
pub mod norr_launch {{
    use super::*;

    pub fn create(ctx: Context<Create>, args: CreateArgs) -> Result<()> {{
        require!(args.model <= 1, LaunchError::OutOfRange);
        require!(!args.name.is_empty() && !args.symbol.is_empty(), LaunchError::EmptyField);
        require!(args.name.as_bytes().len() <= 64, LaunchError::BoundsExceeded);
        require!(args.symbol.as_bytes().len() <= 16, LaunchError::BoundsExceeded);
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
        emit!(LaunchCreated {{ launch: launch.key(), creator: launch.creator, model: launch.model }});
        Ok(())
    }}

    pub fn attach_board(ctx: Context<Configure>, board: Pubkey) -> Result<()> {{
        require!(ctx.accounts.launch.flags & ACTIVE == 0, LaunchError::AlreadyFinalized);
        ctx.accounts.launch.board = board;
        emit!(BoardAttached {{ launch: ctx.accounts.launch.key(), board }});
        Ok(())
    }}

    pub fn set_uri(ctx: Context<Configure>, uri: String, metadata_hash: [u8; 32]) -> Result<()> {{
        require!(ctx.accounts.launch.flags & ACTIVE == 0, LaunchError::AlreadyFinalized);
        validate_uri(&uri)?;
        ctx.accounts.launch.uri = uri;
        ctx.accounts.launch.metadata_hash = metadata_hash;
        Ok(())
    }}

    // Activation is deliberately fail-closed until the generated CPI adapters can prove
    // every ADR-012 item atomically against Router + Sale/Curve + mint accounts.
    pub fn activate(_ctx: Context<Configure>) -> Result<()> {{
        err!(LaunchError::ActivationChecklistRequired)
    }}
}}

fn validate_uri(uri: &str) -> Result<()> {{
    require!(!uri.is_empty() && uri.as_bytes().len() <= 200, LaunchError::BoundsExceeded);
    require!(!uri.starts_with("data:"), LaunchError::UnsupportedUri);
    Ok(())
}}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateArgs {{
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
}}

#[derive(Accounts)]
#[instruction(args: CreateArgs)]
pub struct Create<'info> {{
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
}}

#[derive(Accounts)]
pub struct Configure<'info> {{
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [b"launch", launch.project_mint.as_ref()],
        bump = launch.bump,
        has_one = creator
    )]
    pub launch: Account<'info, Launch>,
}}

#[account]
pub struct Launch {{
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
}}
impl Launch {{ pub const LEN: usize = 8 + 32 * 7 + 1 + 8 + 1 + 32 + (4 + 64) + (4 + 16) + (4 + 200) + 1; }}

#[event] pub struct LaunchCreated {{ pub launch: Pubkey, pub creator: Pubkey, pub model: u8 }}
#[event] pub struct BoardAttached {{ pub launch: Pubkey, pub board: Pubkey }}

#[error_code]
pub enum LaunchError {{
    #[msg("Already finalized")] AlreadyFinalized,
    #[msg("Empty field")] EmptyField,
    #[msg("Out of range")] OutOfRange,
    #[msg("Bounds exceeded")] BoundsExceeded,
    #[msg("Data URIs are not accepted")] UnsupportedUri,
    #[msg("Full on-chain activation checklist and CPI adapters required")] ActivationChecklistRequired,
}}
''')

put('programs/norr-fees/src/lib.rs',f'''
use anchor_lang::prelude::*;
declare_id!("{ids['norr_fees']}");
const DENOMINATOR: u64 = 10_000;
const MAX_SPLITS: usize = 8;

#[program]
pub mod norr_fees {{
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, values: Vec<SplitInput>) -> Result<()> {{
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
        for (index, value) in values.iter().enumerate() {{ router.splits[index] = value.into(); }}
        router.bump = ctx.bumps.router;
        Ok(())
    }}
    pub fn lock(ctx: Context<Configure>) -> Result<()> {{
        require!(!ctx.accounts.router.locked, FeeError::AlreadyLocked);
        ctx.accounts.router.locked = true;
        emit!(RouterLocked {{ router: ctx.accounts.router.key() }});
        Ok(())
    }}
    pub fn sync(ctx: Context<Sync>) -> Result<()> {{
        let router = &mut ctx.accounts.router;
        require!(router.locked, FeeError::NotReady);
        let tracked = router.total_received.checked_sub(router.total_released).ok_or(FeeError::MathOverflow)?;
        let delta = ctx.accounts.vault.amount.checked_sub(tracked).ok_or(FeeError::Insolvent)?;
        if delta == 0 {{ return Ok(()); }}
        let count = usize::from(router.split_count);
        let remainder = (0..count).max_by_key(|i| (router.splits[*i].bps, std::cmp::Reverse(*i))).ok_or(FeeError::NoSplits)?;
        let mut additions = [0u64; MAX_SPLITS];
        let mut allocated = 0u64;
        for index in 0..count {{
            if index == remainder {{ continue; }}
            let raw = u128::from(delta).checked_mul(u128::from(router.splits[index].bps)).ok_or(FeeError::MathOverflow)? / u128::from(DENOMINATOR);
            additions[index] = u64::try_from(raw).map_err(|_| FeeError::MathOverflow)?;
            allocated = allocated.checked_add(additions[index]).ok_or(FeeError::MathOverflow)?;
        }}
        additions[remainder] = delta.checked_sub(allocated).ok_or(FeeError::MathOverflow)?;
        for index in 0..count {{ router.splits[index].accrued = router.splits[index].accrued.checked_add(additions[index]).ok_or(FeeError::MathOverflow)?; }}
        router.total_received = router.total_received.checked_add(delta).ok_or(FeeError::MathOverflow)?;
        emit!(Synced {{ router: router.key(), amount: delta }});
        Ok(())
    }}
    // The release transfer is left disabled rather than recording accounting before a
    // generated canonical-ATA token CPI is compiled and audited.
    pub fn release(_ctx: Context<Sync>, _recipient: Pubkey) -> Result<()> {{ err!(FeeError::TokenTransferAdapterRequired) }}
}}

fn validate(values: &[SplitInput]) -> Result<()> {{
    require!(!values.is_empty() && values.len() <= MAX_SPLITS, FeeError::NoSplits);
    let mut total = 0u64;
    for (index, value) in values.iter().enumerate() {{
        require!(value.recipient != Pubkey::default(), FeeError::ZeroRecipient);
        require!(value.bps > 0, FeeError::ZeroBps);
        require!(!values[..index].iter().any(|prior| prior.recipient == value.recipient), FeeError::DuplicateRecipient);
        total = total.checked_add(u64::from(value.bps)).ok_or(FeeError::MathOverflow)?;
    }}
    require!(total == DENOMINATOR, FeeError::BpsMustTotalDenominator);
    Ok(())
}}

#[derive(Accounts)]
pub struct Initialize<'info> {{
    #[account(mut)] pub authority: Signer<'info>,
    /// CHECK: deterministic Launch PDA; identity only during resumable setup.
    pub launch: UncheckedAccount<'info>,
    /// CHECK: pinned legacy SPL mint, validated during activation.
    pub asset_mint: UncheckedAccount<'info>,
    /// CHECK: canonical Router-owned token account, validated before value movement.
    pub vault: UncheckedAccount<'info>,
    #[account(init, payer = authority, space = Router::LEN, seeds = [b"router", launch.key().as_ref()], bump)]
    pub router: Account<'info, Router>,
    pub system_program: Program<'info, System>,
}}
#[derive(Accounts)]
pub struct Configure<'info> {{
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"router", router.launch.as_ref()], bump=router.bump, has_one=authority)]
    pub router: Account<'info, Router>,
}}
#[derive(Accounts)]
pub struct Sync<'info> {{
    #[account(mut, seeds=[b"router", router.launch.as_ref()], bump=router.bump, has_one=vault)]
    pub router: Account<'info, Router>,
    #[account(constraint=vault.owner == router.key(), constraint=vault.mint == router.asset_mint)]
    pub vault: Account<'info, anchor_spl::token::TokenAccount>,
}}

#[account]
pub struct Router {{
    pub launch: Pubkey, pub authority: Pubkey, pub asset_mint: Pubkey, pub vault: Pubkey,
    pub total_received: u64, pub total_released: u64, pub locked: bool, pub split_count: u8,
    pub splits: [Split; MAX_SPLITS], pub bump: u8,
}}
impl Router {{ pub const LEN: usize = 8 + 32*4 + 8 + 8 + 1 + 1 + 8*Split::LEN + 1; }}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct Split {{ pub recipient: Pubkey, pub bps: u16, pub category: u8, pub accrued: u64, pub released: u64 }}
impl Split {{ pub const LEN: usize = 32 + 2 + 1 + 8 + 8; }}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SplitInput {{ pub recipient: Pubkey, pub bps: u16, pub category: u8 }}
impl From<&SplitInput> for Split {{ fn from(value: &SplitInput) -> Self {{ Self {{ recipient:value.recipient,bps:value.bps,category:value.category,accrued:0,released:0 }} }} }}
#[event] pub struct RouterLocked {{ pub router: Pubkey }}
#[event] pub struct Synced {{ pub router: Pubkey, pub amount: u64 }}
#[error_code] pub enum FeeError {{
 #[msg("Already locked")] AlreadyLocked, #[msg("No splits")] NoSplits,
 #[msg("Bps must total denominator")] BpsMustTotalDenominator, #[msg("Zero recipient")] ZeroRecipient,
 #[msg("Zero bps")] ZeroBps, #[msg("Duplicate recipient")] DuplicateRecipient,
 #[msg("Math overflow")] MathOverflow, #[msg("Bounds exceeded")] BoundsExceeded,
 #[msg("Not ready")] NotReady, #[msg("Insolvent")] Insolvent,
 #[msg("Canonical token transfer adapter required")] TokenTransferAdapterRequired,
}}
''')

put('programs/norr-market/src/lib.rs',f'''
use anchor_lang::prelude::*;
declare_id!("{ids['norr_market']}");
const DENOMINATOR: u128 = 10_000;
const MIN_TOKEN_RESERVE: u64 = 1_000;
const MAX_RESERVE: u64 = 1u64 << 63;

#[program]
pub mod norr_market {{
 use super::*;
 pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {{
  require!(args.virtual_base > 0 && args.token_reserve >= MIN_TOKEN_RESERVE, MarketError::BoundsExceeded);
  require!(args.fee_bps <= 1_000, MarketError::FeeTooHigh);
  let curve=&mut ctx.accounts.curve;
  curve.launch=ctx.accounts.launch.key(); curve.project_mint=args.project_mint; curve.base_mint=args.base_mint;
  curve.token_vault=args.token_vault; curve.base_vault=args.base_vault; curve.router=args.router;
  curve.liquidity_beneficiary=args.liquidity_beneficiary; curve.damm_position=Pubkey::default();
  curve.virtual_base=args.virtual_base; curve.base_reserve=0; curve.token_reserve=args.token_reserve;
  curve.graduation_target=args.graduation_target; curve.fee_bps=args.fee_bps; curve.active=false; curve.graduated=false;
  curve.created_slot=Clock::get()?.slot; curve.max_buy_first_slots=args.max_buy_first_slots;
  curve.liquidity_unlock_at=args.liquidity_unlock_at; curve.bump=ctx.bumps.curve; Ok(())
 }}
 pub fn activate(_ctx: Context<Configure>) -> Result<()> {{ err!(MarketError::ActivationChecklistRequired) }}
 pub fn buy(_ctx: Context<Configure>, _base_in:u64, _min_out:u64) -> Result<()> {{ err!(MarketError::TokenTransferAdapterRequired) }}
 pub fn sell(_ctx: Context<Configure>, _tokens_in:u64, _min_out:u64) -> Result<()> {{ err!(MarketError::TokenTransferAdapterRequired) }}
 pub fn graduate(_ctx: Context<Configure>) -> Result<()> {{ err!(MarketError::DammIntegrationRequired) }}
}}

pub fn ceil_div(n:u128,d:u128)->Result<u128>{{ require!(d>0,MarketError::BoundsExceeded); Ok(n/d+u128::from(n%d!=0)) }}
pub fn quote_buy(virtual_base:u64,base_reserve:u64,token_reserve:u64,base_in:u64,fee_bps:u16)->Result<(u64,u64,u64)> {{
 require!(base_in>0 && fee_bps<=1_000,MarketError::FeeTooHigh);
 let effective=virtual_base.checked_add(base_reserve).ok_or(MarketError::MathOverflow)?;
 require!(effective<=MAX_RESERVE && token_reserve>=MIN_TOKEN_RESERVE && token_reserve<=MAX_RESERVE,MarketError::BoundsExceeded);
 let fee=u64::try_from(u128::from(base_in)*u128::from(fee_bps)/DENOMINATOR).map_err(|_|MarketError::MathOverflow)?;
 let net=base_in.checked_sub(fee).ok_or(MarketError::MathOverflow)?;
 let k=u128::from(effective).checked_mul(u128::from(token_reserve)).ok_or(MarketError::MathOverflow)?;
 let new_reserve=u64::try_from(ceil_div(k,u128::from(effective.checked_add(net).ok_or(MarketError::MathOverflow)?))?).map_err(|_|MarketError::MathOverflow)?;
 require!(new_reserve>=MIN_TOKEN_RESERVE,MarketError::InsufficientReserve);
 Ok((fee,net,token_reserve.checked_sub(new_reserve).ok_or(MarketError::MathOverflow)?))
}}

#[derive(AnchorSerialize,AnchorDeserialize,Clone)]
pub struct InitializeArgs {{ pub project_mint:Pubkey,pub base_mint:Pubkey,pub token_vault:Pubkey,pub base_vault:Pubkey,pub router:Pubkey,pub liquidity_beneficiary:Pubkey,pub virtual_base:u64,pub token_reserve:u64,pub graduation_target:u64,pub fee_bps:u16,pub max_buy_first_slots:u64,pub liquidity_unlock_at:i64 }}
#[derive(Accounts)]#[instruction(args:InitializeArgs)]
pub struct Initialize<'info>{{
 #[account(mut)] pub payer:Signer<'info>,
 /// CHECK: deterministic Launch PDA.
 pub launch:UncheckedAccount<'info>,
 #[account(init,payer=payer,space=Curve::LEN,seeds=[b"curve",args.project_mint.as_ref()],bump)] pub curve:Account<'info,Curve>,
 pub system_program:Program<'info,System>,
}}
#[derive(Accounts)] pub struct Configure<'info>{{ #[account(mut,seeds=[b"curve",curve.project_mint.as_ref()],bump=curve.bump)] pub curve:Account<'info,Curve> }}
#[account] pub struct Curve {{ pub launch:Pubkey,pub project_mint:Pubkey,pub base_mint:Pubkey,pub token_vault:Pubkey,pub base_vault:Pubkey,pub router:Pubkey,pub liquidity_beneficiary:Pubkey,pub damm_position:Pubkey,pub virtual_base:u64,pub base_reserve:u64,pub token_reserve:u64,pub graduation_target:u64,pub fee_bps:u16,pub active:bool,pub graduated:bool,pub created_slot:u64,pub max_buy_first_slots:u64,pub liquidity_unlock_at:i64,pub bump:u8 }}
impl Curve{{pub const LEN:usize=8+32*8+8*4+2+1+1+8+8+8+1;}}
#[error_code] pub enum MarketError {{ #[msg("Fee too high")]FeeTooHigh,#[msg("Insufficient reserve")]InsufficientReserve,#[msg("Math overflow")]MathOverflow,#[msg("Bounds exceeded")]BoundsExceeded,#[msg("Activation checklist required")]ActivationChecklistRequired,#[msg("Canonical token transfer adapter required")]TokenTransferAdapterRequired,#[msg("Pinned Meteora DAMM v2 adapter required")]DammIntegrationRequired }}
''')

put('programs/norr-boards/src/lib.rs',f'''
use anchor_lang::prelude::*;
declare_id!("{ids['norr_boards']}");
#[program] pub mod norr_boards{{use super::*;
 pub fn create(ctx:Context<Create>,slug:String,name:String,uri:String,min_bps:u16,allowlist_only:bool)->Result<()>{{
  require!(!slug.is_empty()&&!name.is_empty(),BoardError::EmptyField);require!(slug.as_bytes().len()<=32,BoardError::SlugTooLong);require!(name.as_bytes().len()<=64&&uri.as_bytes().len()<=200,BoardError::BoundsExceeded);require!(min_bps<=5_000,BoardError::ShareTooHigh);
  let b=&mut ctx.accounts.board;b.owner=ctx.accounts.owner.key();b.min_bps=min_bps;b.launch_count=0;b.created_at=Clock::get()?.unix_timestamp;b.allowlist_only=allowlist_only;b.slug=slug;b.name=name;b.uri=uri;b.bump=ctx.bumps.board;Ok(())
 }}
 pub fn update(ctx:Context<Update>,name:String,uri:String)->Result<()>{{require!(!name.is_empty()&&name.as_bytes().len()<=64&&uri.as_bytes().len()<=200,BoardError::BoundsExceeded);ctx.accounts.board.name=name;ctx.accounts.board.uri=uri;Ok(())}}
 pub fn set_terms(ctx:Context<Update>,min_bps:u16,allowlist_only:bool)->Result<()>{{require!(min_bps<=5_000,BoardError::ShareTooHigh);ctx.accounts.board.min_bps=min_bps;ctx.accounts.board.allowlist_only=allowlist_only;Ok(())}}
}}
#[derive(Accounts)]#[instruction(slug:String)]pub struct Create<'info>{{#[account(mut)]pub owner:Signer<'info>,#[account(init,payer=owner,space=Board::LEN,seeds=[b"board",slug.as_bytes()],bump)]pub board:Account<'info,Board>,pub system_program:Program<'info,System>}}
#[derive(Accounts)]pub struct Update<'info>{{pub owner:Signer<'info>,#[account(mut,seeds=[b"board",board.slug.as_bytes()],bump=board.bump,has_one=owner)]pub board:Account<'info,Board>}}
#[account]pub struct Board{{pub owner:Pubkey,pub min_bps:u16,pub launch_count:u32,pub created_at:i64,pub allowlist_only:bool,pub slug:String,pub name:String,pub uri:String,pub bump:u8}}impl Board{{pub const LEN:usize=8+32+2+4+8+1+(4+32)+(4+64)+(4+200)+1;}}
#[error_code]pub enum BoardError{{#[msg("Empty field")]EmptyField,#[msg("Slug too long")]SlugTooLong,#[msg("Share too high")]ShareTooHigh,#[msg("Bounds exceeded")]BoundsExceeded}}
''')

put('programs/norr-social/src/lib.rs',f'''
use anchor_lang::prelude::*;
declare_id!("{ids['norr_social']}");
#[program]pub mod norr_social{{use super::*;
 pub fn initialize_thread(ctx:Context<InitializeThread>)->Result<()>{{let t=&mut ctx.accounts.thread;t.subject=ctx.accounts.subject.key();t.next_index=0;t.count=0;t.bump=ctx.bumps.thread;Ok(())}}
 pub fn post(ctx:Context<Post>,parent_index:u32,body:String)->Result<()>{{require!(!body.is_empty(),SocialError::EmptyBody);require!(body.as_bytes().len()<=1_000,SocialError::BodyTooLong);let t=&mut ctx.accounts.thread;if parent_index!=u32::MAX{{require!(parent_index<t.next_index,SocialError::OutOfRange);}}let c=&mut ctx.accounts.comment;c.subject=t.subject;c.author=ctx.accounts.author.key();c.posted_at=Clock::get()?.unix_timestamp;c.index=t.next_index;c.parent_index=parent_index;c.hidden=false;c.body=body;c.bump=ctx.bumps.comment;t.next_index=t.next_index.checked_add(1).ok_or(SocialError::MathOverflow)?;t.count=t.count.checked_add(1).ok_or(SocialError::MathOverflow)?;Ok(())}}
 pub fn hide(ctx:Context<Hide>)->Result<()>{{require!(!ctx.accounts.comment.hidden,SocialError::AlreadyHidden);ctx.accounts.comment.hidden=true;ctx.accounts.comment.body.clear();Ok(())}}
}}
#[derive(Accounts)]pub struct InitializeThread<'info>{{#[account(mut)]pub payer:Signer<'info>,/// CHECK: subject identity only.
 pub subject:UncheckedAccount<'info>,#[account(init,payer=payer,space=Thread::LEN,seeds=[b"thread",subject.key().as_ref()],bump)]pub thread:Account<'info,Thread>,pub system_program:Program<'info,System>}}
#[derive(Accounts)]pub struct Post<'info>{{#[account(mut)]pub author:Signer<'info>,#[account(mut,seeds=[b"thread",thread.subject.as_ref()],bump=thread.bump)]pub thread:Account<'info,Thread>,#[account(init,payer=author,space=Comment::LEN,seeds=[b"comment",thread.subject.as_ref(),&thread.next_index.to_le_bytes()],bump)]pub comment:Account<'info,Comment>,pub system_program:Program<'info,System>}}
#[derive(Accounts)]pub struct Hide<'info>{{pub author:Signer<'info>,#[account(mut,has_one=author)]pub comment:Account<'info,Comment>}}
#[account]pub struct Thread{{pub subject:Pubkey,pub next_index:u32,pub count:u32,pub bump:u8}}impl Thread{{pub const LEN:usize=8+32+4+4+1;}}
#[account]pub struct Comment{{pub subject:Pubkey,pub author:Pubkey,pub posted_at:i64,pub index:u32,pub parent_index:u32,pub hidden:bool,pub body:String,pub bump:u8}}impl Comment{{pub const LEN:usize=8+32+32+8+4+4+1+4+1_000+1;}}
#[account]pub struct Profile{{pub wallet:Pubkey,pub follower_count:u32,pub following_count:u32,pub saved_count:u32,pub post_count:u32,pub bump:u8}}impl Profile{{pub const LEN:usize=8+32+4*4+1;}}
#[account]pub struct Follow{{pub follower:Pubkey,pub target:Pubkey,pub bump:u8}}impl Follow{{pub const LEN:usize=8+32+32+1;}}
#[account]pub struct Saved{{pub account:Pubkey,pub subject:Pubkey,pub bump:u8}}impl Saved{{pub const LEN:usize=8+32+32+1;}}
#[account]pub struct Promo{{pub subject:Pubkey,pub promoted_until:i64,pub tier:u8,pub bump:u8}}impl Promo{{pub const LEN:usize=8+32+8+1+1;}}
#[error_code]pub enum SocialError{{#[msg("Empty body")]EmptyBody,#[msg("Body too long")]BodyTooLong,#[msg("Already hidden")]AlreadyHidden,#[msg("Out of range")]OutOfRange,#[msg("Math overflow")]MathOverflow}}
''')

put('programs/norr-claim/src/lib.rs',f'''
use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;
declare_id!("{ids['norr_claim']}");
const MAX_PROOF:usize=20;
pub mod state{{pub const SETUP:u8=0;pub const ACCEPTING:u8=1;pub const ALLOCATION_COMMITTED:u8=2;pub const CLAIMS_OPEN:u8=4;pub const REFUND_COMMITTED:u8=5;pub const REFUNDS_OPEN:u8=6;}}
#[program]pub mod norr_claim{{use super::*;
 pub fn initialize(ctx:Context<Initialize>,args:InitializeArgs)->Result<()>{{require!(args.ends_at>args.starts_at&&args.ends_at-args.starts_at<=2_592_000,ClaimError::BoundsExceeded);let s=&mut ctx.accounts.sale;s.launch=ctx.accounts.launch.key();s.tally_authority=args.tally_authority;s.emergency_authority=args.emergency_authority;s.project_mint=args.project_mint;s.contribution_mint=args.contribution_mint;s.vault=args.vault;s.token_vault=args.token_vault;s.router=args.router;s.wrap_config=args.wrap_config;s.settlement_mint=args.settlement_mint;s.settlement_vault=args.settlement_vault;s.starts_at=args.starts_at;s.ends_at=args.ends_at;s.merkle_root=[0;32];s.tally_manifest_hash=[0;32];s.contribution_chain_hash=[0;32];s.settlement_not_before=0;s.settlement_deadline=args.ends_at.checked_add(604_800).ok_or(ClaimError::MathOverflow)?;s.total_contributed=0;s.total_allocated=0;s.total_claimed=0;s.settled_amount=0;s.contribution_count=0;s.claimant_count=0;s.tally_revision=0;s.state=state::SETUP;s.bump=ctx.bumps.sale;Ok(())}}
 pub fn activate(_ctx:Context<Configure>)->Result<()>{{err!(ClaimError::P0Required)}}
 pub fn contribute(_ctx:Context<Configure>,_context_hash:[u8;32])->Result<()>{{err!(ClaimError::P0Required)}}
 pub fn settle(_ctx:Context<Configure>,_amount:u64)->Result<()>{{err!(ClaimError::P0Required)}}
 pub fn settle_refund(_ctx:Context<Configure>,_amount:u64)->Result<()>{{err!(ClaimError::P0Required)}}
 pub fn open_claim(ctx:Context<OpenClaim>,allocation:u64,proof:Vec<[u8;32]>)->Result<()>{{let s=&ctx.accounts.sale;require!(s.state==state::CLAIMS_OPEN||s.state==state::REFUNDS_OPEN,ClaimError::NotReady);require!(allocation>0&&proof.len()<=MAX_PROOF,ClaimError::BoundsExceeded);let mint=if s.state==state::CLAIMS_OPEN{{s.project_mint}}else{{s.settlement_mint}};let domain=if s.state==state::CLAIMS_OPEN{{b"norr-claim-v1".as_slice()}}else{{b"norr-refund-v1".as_slice()}};let amount=allocation.to_le_bytes();let inner=keccak::hashv(&[domain,crate::ID.as_ref(),s.key().as_ref(),mint.as_ref(),ctx.accounts.claimant.key().as_ref(),&amount]).0;let mut node=keccak::hash(&inner).0;for sibling in proof{{node=if node<=sibling{{keccak::hashv(&[&node,&sibling]).0}}else{{keccak::hashv(&[&sibling,&node]).0}};}}require!(node==s.merkle_root,ClaimError::InvalidProof);let c=&mut ctx.accounts.claim_status;c.sale=s.key();c.claimant=ctx.accounts.claimant.key();c.allocation=allocation;c.claimed=0;c.bump=ctx.bumps.claim_status;Ok(())}}
}}
#[derive(AnchorSerialize,AnchorDeserialize,Clone)]pub struct InitializeArgs{{pub tally_authority:Pubkey,pub emergency_authority:Pubkey,pub project_mint:Pubkey,pub contribution_mint:Pubkey,pub vault:Pubkey,pub token_vault:Pubkey,pub router:Pubkey,pub wrap_config:Pubkey,pub settlement_mint:Pubkey,pub settlement_vault:Pubkey,pub starts_at:i64,pub ends_at:i64}}
#[derive(Accounts)]pub struct Initialize<'info>{{#[account(mut)]pub payer:Signer<'info>,/// CHECK: deterministic Launch PDA.
 pub launch:UncheckedAccount<'info>,#[account(init,payer=payer,space=Sale::LEN,seeds=[b"sale",launch.key().as_ref()],bump)]pub sale:Account<'info,Sale>,pub system_program:Program<'info,System>}}
#[derive(Accounts)]pub struct Configure<'info>{{#[account(mut,seeds=[b"sale",sale.launch.as_ref()],bump=sale.bump)]pub sale:Account<'info,Sale>}}
#[derive(Accounts)]pub struct OpenClaim<'info>{{#[account(mut)]pub claimant:Signer<'info>,#[account(seeds=[b"sale",sale.launch.as_ref()],bump=sale.bump)]pub sale:Account<'info,Sale>,#[account(init,payer=claimant,space=ClaimStatus::LEN,seeds=[b"claim",sale.key().as_ref(),claimant.key().as_ref()],bump)]pub claim_status:Account<'info,ClaimStatus>,pub system_program:Program<'info,System>}}
#[account]pub struct Sale{{pub launch:Pubkey,pub tally_authority:Pubkey,pub emergency_authority:Pubkey,pub project_mint:Pubkey,pub contribution_mint:Pubkey,pub vault:Pubkey,pub token_vault:Pubkey,pub router:Pubkey,pub wrap_config:Pubkey,pub settlement_mint:Pubkey,pub settlement_vault:Pubkey,pub starts_at:i64,pub ends_at:i64,pub merkle_root:[u8;32],pub tally_manifest_hash:[u8;32],pub contribution_chain_hash:[u8;32],pub settlement_not_before:i64,pub settlement_deadline:i64,pub total_contributed:u64,pub total_allocated:u64,pub total_claimed:u64,pub settled_amount:u64,pub contribution_count:u32,pub claimant_count:u32,pub tally_revision:u32,pub state:u8,pub bump:u8}}impl Sale{{pub const LEN:usize=8+32*11+8*2+32*3+8*2+8*4+4*3+1+1;}}
#[account]pub struct ClaimStatus{{pub sale:Pubkey,pub claimant:Pubkey,pub allocation:u64,pub claimed:u64,pub bump:u8}}impl ClaimStatus{{pub const LEN:usize=8+32+32+8+8+1;}}
#[error_code]pub enum ClaimError{{#[msg("Invalid proof")]InvalidProof,#[msg("Not ready")]NotReady,#[msg("Math overflow")]MathOverflow,#[msg("Bounds exceeded")]BoundsExceeded,#[msg("P0 target-cluster confidential-transfer gate required")]P0Required}}
''')

put('programs/norr-wrap/src/lib.rs',f'''
use anchor_lang::prelude::*;
declare_id!("{ids['norr_wrap']}");
#[program]pub mod norr_wrap{{use super::*;
 pub fn initialize(_ctx:Context<Initialize>,_args:InitializeArgs)->Result<()>{{err!(WrapError::P0Required)}}
 pub fn wrap(_ctx:Context<Operate>,_amount:u64)->Result<()>{{err!(WrapError::P0Required)}}
 pub fn unwrap(_ctx:Context<Operate>,_amount:u64)->Result<()>{{err!(WrapError::P0Required)}}
 pub fn rotate_auditor(_ctx:Context<Configure>,_key:[u8;32])->Result<()>{{err!(WrapError::P0Required)}}
 pub fn set_paused(ctx:Context<Configure>,paused:bool)->Result<()>{{ctx.accounts.config.paused=paused;Ok(())}}
 pub fn recover_excess(_ctx:Context<Operate>)->Result<()>{{err!(WrapError::P0Required)}}
}}
#[derive(AnchorSerialize,AnchorDeserialize,Clone)]pub struct InitializeArgs{{pub underlying_mint:Pubkey,pub confidential_mint:Pubkey,pub underlying_token_program:Pubkey,pub vault:Pubkey,pub ct_mint_authority:Pubkey,pub excess_recipient:Pubkey,pub auditor_elgamal_pubkey:[u8;32]}}
#[derive(Accounts)]#[instruction(args:InitializeArgs)]pub struct Initialize<'info>{{#[account(mut)]pub authority:Signer<'info>,#[account(init,payer=authority,space=WrapConfig::LEN,seeds=[b"cmint",args.underlying_mint.as_ref()],bump)]pub config:Account<'info,WrapConfig>,pub system_program:Program<'info,System>}}
#[derive(Accounts)]pub struct Operate<'info>{{#[account(mut)]pub actor:Signer<'info>,#[account(mut,seeds=[b"cmint",config.underlying_mint.as_ref()],bump=config.bump)]pub config:Account<'info,WrapConfig>}}
#[derive(Accounts)]pub struct Configure<'info>{{pub authority:Signer<'info>,#[account(mut,has_one=authority)]pub config:Account<'info,WrapConfig>}}
#[account]pub struct WrapConfig{{pub underlying_mint:Pubkey,pub confidential_mint:Pubkey,pub underlying_token_program:Pubkey,pub vault:Pubkey,pub authority:Pubkey,pub ct_mint_authority:Pubkey,pub excess_recipient:Pubkey,pub auditor_elgamal_pubkey:[u8;32],pub auditor_epoch:u32,pub total_liability:u64,pub paused:bool,pub bump:u8}}impl WrapConfig{{pub const LEN:usize=8+32*7+32+4+8+1+1;}}
#[error_code]pub enum WrapError{{#[msg("P0 target-cluster confidential-transfer gate required")]P0Required}}
''')

put('scripts/audit-source.sh','''#!/usr/bin/env bash
set -euo pipefail
for p in norr-launch norr-claim norr-fees norr-market norr-boards norr-social norr-wrap; do test -s "programs/$p/src/lib.rs"; done
! rg -n '\\bas\\s+u(8|16|32|64)\\b|\\.unwrap\\(|\\.expect\\(' programs --glob '*.rs'
echo "static source audit passed; this is not an Anchor build"
''')
(root/'scripts/audit-source.sh').chmod(0o755)
print('generated seven fail-closed Anchor crates')
