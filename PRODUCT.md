# Product — norr.fun on Solana

**Private contribution, public settlement.** norr.fun is a Solana launch surface for
founders, contributors, desk operators, and fee recipients. Contribution *amounts* stay
confidential while a sealed raise is accepting; participants, timing, account relationships,
and wrapper backing remain visible. After review, an on-chain Merkle commitment makes every
allocation locally verifiable and permissionlessly claimable.

Current state comes from program accounts. A disposable indexer adds history and search but
never decides balances, claimability, authority, or transaction construction. Instant
markets use public USDC and a project token on legacy SPL Token. Confidential cUSDC crosses
to public USDC only inside the claim settlement path.

The interface is terse and consequence-first. It never prints a contribution amount while a
sale is open, never invents figures, never shows a meter without its denominator, and always
models sent, processed, confirmed, finalized, rejected, expired, and failed transaction
states.
