#![allow(
    deprecated,
    unexpected_cfgs,
    clippy::needless_as_bytes,
    clippy::needless_range_loop
)]
use anchor_lang::prelude::*;
declare_id!("4BNL4GDkUFkCdVZTXo9e3KYRDsD32DXdcrTYJXiucs7g");

#[program]
pub mod norr_social {
    use super::*;

    pub fn initialize_thread(ctx: Context<InitializeThread>) -> Result<()> {
        let t = &mut ctx.accounts.thread;
        t.subject = ctx.accounts.subject.key();
        t.next_index = 0;
        t.count = 0;
        t.bump = ctx.bumps.thread;
        Ok(())
    }

    pub fn post(ctx: Context<Post>, parent_index: u32, body: String) -> Result<()> {
        require!(!body.is_empty(), SocialError::EmptyBody);
        require!(body.len() <= 1_000, SocialError::BodyTooLong);

        let t = &mut ctx.accounts.thread;
        if parent_index != u32::MAX {
            require!(parent_index < t.next_index, SocialError::OutOfRange);
        }

        let c = &mut ctx.accounts.comment;
        c.subject = t.subject;
        c.author = ctx.accounts.author.key();
        c.posted_at = Clock::get()?.unix_timestamp;
        c.index = t.next_index;
        c.parent_index = parent_index;
        c.hidden = false;
        c.body = body;
        c.bump = ctx.bumps.comment;

        t.next_index = t
            .next_index
            .checked_add(1)
            .ok_or(SocialError::MathOverflow)?;
        t.count = t.count.checked_add(1).ok_or(SocialError::MathOverflow)?;

        ctx.accounts.profile.post_count = ctx
            .accounts
            .profile
            .post_count
            .checked_add(1)
            .ok_or(SocialError::MathOverflow)?;

        Ok(())
    }

    pub fn hide(ctx: Context<Hide>) -> Result<()> {
        require!(!ctx.accounts.comment.hidden, SocialError::AlreadyHidden);
        ctx.accounts.comment.hidden = true;
        ctx.accounts.comment.body.clear();
        Ok(())
    }

    pub fn create_profile(ctx: Context<CreateProfile>) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.wallet = ctx.accounts.wallet.key();
        profile.follower_count = 0;
        profile.following_count = 0;
        profile.saved_count = 0;
        profile.post_count = 0;
        profile.bump = ctx.bumps.profile;
        Ok(())
    }

    pub fn follow(ctx: Context<FollowAction>) -> Result<()> {
        require!(
            ctx.accounts.follower.key() != ctx.accounts.target.key(),
            SocialError::CannotFollowSelf
        );

        let follow = &mut ctx.accounts.follow;
        follow.follower = ctx.accounts.follower.key();
        follow.target = ctx.accounts.target.key();
        follow.bump = ctx.bumps.follow;

        ctx.accounts.follower_profile.following_count = ctx
            .accounts
            .follower_profile
            .following_count
            .checked_add(1)
            .ok_or(SocialError::MathOverflow)?;

        ctx.accounts.target_profile.follower_count = ctx
            .accounts
            .target_profile
            .follower_count
            .checked_add(1)
            .ok_or(SocialError::MathOverflow)?;
        Ok(())
    }

    pub fn unfollow(ctx: Context<UnfollowAction>) -> Result<()> {
        ctx.accounts.follower_profile.following_count = ctx
            .accounts
            .follower_profile
            .following_count
            .checked_sub(1)
            .ok_or(SocialError::MathOverflow)?;

        ctx.accounts.target_profile.follower_count = ctx
            .accounts
            .target_profile
            .follower_count
            .checked_sub(1)
            .ok_or(SocialError::MathOverflow)?;
        Ok(())
    }

    pub fn save(ctx: Context<SaveAction>) -> Result<()> {
        let saved = &mut ctx.accounts.saved;
        saved.account = ctx.accounts.user.key();
        saved.subject = ctx.accounts.subject.key();
        saved.bump = ctx.bumps.saved;

        ctx.accounts.profile.saved_count = ctx
            .accounts
            .profile
            .saved_count
            .checked_add(1)
            .ok_or(SocialError::MathOverflow)?;

        let stats = &mut ctx.accounts.subject_stats;
        stats.subject = ctx.accounts.subject.key();
        stats.save_count = stats
            .save_count
            .checked_add(1)
            .ok_or(SocialError::MathOverflow)?;
        stats.bump = ctx.bumps.subject_stats;
        Ok(())
    }

    pub fn unsave(ctx: Context<UnsaveAction>) -> Result<()> {
        ctx.accounts.profile.saved_count = ctx
            .accounts
            .profile
            .saved_count
            .checked_sub(1)
            .ok_or(SocialError::MathOverflow)?;

        ctx.accounts.subject_stats.save_count = ctx
            .accounts
            .subject_stats
            .save_count
            .checked_sub(1)
            .ok_or(SocialError::MathOverflow)?;
        Ok(())
    }

    pub fn init_promo_config(
        ctx: Context<InitPromoConfig>,
        tiers: [Tier; 8],
        tier_count: u8,
    ) -> Result<()> {
        let config = &mut ctx.accounts.promo_config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.tier_count = tier_count;
        config.tiers = tiers;
        config.bump = ctx.bumps.promo_config;
        Ok(())
    }

    pub fn update_promo_config(
        ctx: Context<UpdatePromoConfig>,
        tiers: [Tier; 8],
        tier_count: u8,
        treasury: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.promo_config;
        config.treasury = treasury;
        config.tier_count = tier_count;
        config.tiers = tiers;
        Ok(())
    }

    pub fn promote(ctx: Context<PromoteAction>, tier_index: u8) -> Result<()> {
        require!(
            tier_index < ctx.accounts.promo_config.tier_count,
            SocialError::UnknownTier
        );

        let tier = ctx.accounts.promo_config.tiers[tier_index as usize];
        require!(tier.active, SocialError::TierInactive);

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &ctx.accounts.treasury.key(),
            tier.price_lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let promo = &mut ctx.accounts.promo;
        promo.subject = ctx.accounts.subject.key();

        let now = Clock::get()?.unix_timestamp;
        let start = if promo.promoted_until > now {
            promo.promoted_until
        } else {
            now
        };

        promo.promoted_until = start
            .checked_add(tier.duration)
            .ok_or(SocialError::MathOverflow)?;
        promo.tier = tier_index;
        promo.bump = ctx.bumps.promo;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeThread<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: subject identity only.
    pub subject: UncheckedAccount<'info>,
    #[account(init,payer=payer,space=Thread::LEN,seeds=[b"thread",subject.key().as_ref()],bump)]
    pub thread: Account<'info, Thread>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Post<'info> {
    #[account(mut)]
    pub author: Signer<'info>,
    #[account(mut,seeds=[b"thread",thread.subject.as_ref()],bump=thread.bump)]
    pub thread: Account<'info, Thread>,
    #[account(init,payer=author,space=Comment::LEN,seeds=[b"comment",thread.subject.as_ref(),&thread.next_index.to_le_bytes()],bump)]
    pub comment: Account<'info, Comment>,
    #[account(mut, seeds = [b"profile", author.key().as_ref()], bump = profile.bump)]
    pub profile: Account<'info, Profile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Hide<'info> {
    pub author: Signer<'info>,
    #[account(mut,has_one=author)]
    pub comment: Account<'info, Comment>,
}

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    #[account(init, payer = wallet, space = Profile::LEN, seeds = [b"profile", wallet.key().as_ref()], bump)]
    pub profile: Account<'info, Profile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FollowAction<'info> {
    #[account(mut)]
    pub follower: Signer<'info>,
    /// CHECK: The target user to follow
    pub target: UncheckedAccount<'info>,
    #[account(init, payer = follower, space = Follow::LEN, seeds = [b"follow", follower.key().as_ref(), target.key().as_ref()], bump)]
    pub follow: Account<'info, Follow>,
    #[account(mut, seeds = [b"profile", follower.key().as_ref()], bump = follower_profile.bump)]
    pub follower_profile: Account<'info, Profile>,
    #[account(mut, seeds = [b"profile", target.key().as_ref()], bump = target_profile.bump)]
    pub target_profile: Account<'info, Profile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnfollowAction<'info> {
    #[account(mut)]
    pub follower: Signer<'info>,
    #[account(mut, close = follower, seeds = [b"follow", follower.key().as_ref(), follow.target.as_ref()], bump = follow.bump)]
    pub follow: Account<'info, Follow>,
    #[account(mut, seeds = [b"profile", follower.key().as_ref()], bump = follower_profile.bump)]
    pub follower_profile: Account<'info, Profile>,
    #[account(mut, seeds = [b"profile", follow.target.as_ref()], bump = target_profile.bump)]
    pub target_profile: Account<'info, Profile>,
}

#[derive(Accounts)]
pub struct SaveAction<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: subject identity only
    pub subject: UncheckedAccount<'info>,
    #[account(init, payer = user, space = Saved::LEN, seeds = [b"saved", user.key().as_ref(), subject.key().as_ref()], bump)]
    pub saved: Account<'info, Saved>,
    #[account(mut, seeds = [b"profile", user.key().as_ref()], bump = profile.bump)]
    pub profile: Account<'info, Profile>,
    #[account(init_if_needed, payer = user, space = SubjectStats::LEN, seeds = [b"subject", subject.key().as_ref()], bump)]
    pub subject_stats: Account<'info, SubjectStats>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnsaveAction<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, close = user, seeds = [b"saved", user.key().as_ref(), saved.subject.as_ref()], bump = saved.bump)]
    pub saved: Account<'info, Saved>,
    #[account(mut, seeds = [b"profile", user.key().as_ref()], bump = profile.bump)]
    pub profile: Account<'info, Profile>,
    #[account(mut, seeds = [b"subject", saved.subject.as_ref()], bump = subject_stats.bump)]
    pub subject_stats: Account<'info, SubjectStats>,
}

#[derive(Accounts)]
pub struct InitPromoConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Treasury account
    pub treasury: UncheckedAccount<'info>,
    #[account(init, payer = authority, space = PromoConfig::LEN, seeds = [b"promo_config"], bump)]
    pub promo_config: Account<'info, PromoConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePromoConfig<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"promo_config"], bump = promo_config.bump, has_one = authority)]
    pub promo_config: Account<'info, PromoConfig>,
}

#[derive(Accounts)]
pub struct PromoteAction<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The subject to promote
    pub subject: UncheckedAccount<'info>,
    #[account(init_if_needed, payer = payer, space = Promo::LEN, seeds = [b"promo", subject.key().as_ref()], bump)]
    pub promo: Account<'info, Promo>,
    pub promo_config: Account<'info, PromoConfig>,
    #[account(mut, address = promo_config.treasury)]
    /// CHECK: Verified by address constraint
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Thread {
    pub subject: Pubkey,
    pub next_index: u32,
    pub count: u32,
    pub bump: u8,
}
impl Thread {
    pub const LEN: usize = 8 + 32 + 4 + 4 + 1;
}

#[account]
pub struct Comment {
    pub subject: Pubkey,
    pub author: Pubkey,
    pub posted_at: i64,
    pub index: u32,
    pub parent_index: u32,
    pub hidden: bool,
    pub body: String,
    pub bump: u8,
}
impl Comment {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 4 + 4 + 1 + 4 + 1_000 + 1;
}

#[account]
pub struct Profile {
    pub wallet: Pubkey,
    pub follower_count: u32,
    pub following_count: u32,
    pub saved_count: u32,
    pub post_count: u32,
    pub bump: u8,
}
impl Profile {
    pub const LEN: usize = 8 + 32 + 4 * 4 + 1;
}

#[account]
pub struct Follow {
    pub follower: Pubkey,
    pub target: Pubkey,
    pub bump: u8,
}
impl Follow {
    pub const LEN: usize = 8 + 32 + 32 + 1;
}

#[account]
pub struct Saved {
    pub account: Pubkey,
    pub subject: Pubkey,
    pub bump: u8,
}
impl Saved {
    pub const LEN: usize = 8 + 32 + 32 + 1;
}

#[account]
pub struct SubjectStats {
    pub subject: Pubkey,
    pub save_count: u32,
    pub bump: u8,
}
impl SubjectStats {
    pub const LEN: usize = 8 + 32 + 4 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct Tier {
    pub price_lamports: u64,
    pub duration: i64,
    pub active: bool,
    pub name: [u8; 16],
}

#[account]
pub struct PromoConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub tier_count: u8,
    pub tiers: [Tier; 8],
    pub bump: u8,
}
impl PromoConfig {
    pub const LEN: usize = 8 + 32 + 32 + 1 + (8 * 33) + 1;
}

#[account]
pub struct Promo {
    pub subject: Pubkey,
    pub promoted_until: i64,
    pub tier: u8,
    pub bump: u8,
}
impl Promo {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 1;
}

#[error_code]
pub enum SocialError {
    #[msg("Empty body")]
    EmptyBody,
    #[msg("Body too long")]
    BodyTooLong,
    #[msg("Already hidden")]
    AlreadyHidden,
    #[msg("Out of range")]
    OutOfRange,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Cannot follow self")]
    CannotFollowSelf,
    #[msg("Unknown tier")]
    UnknownTier,
    #[msg("Tier inactive")]
    TierInactive,
}
