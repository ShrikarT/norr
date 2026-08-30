# norr.fun on Solana — Technical Build Plan

**Source of truth:** `github.com/nickthelegend/norr-fun` @ `5af8fcd103b7ca4dc45ec6485e5bdb685b0966ea`
**Status:** **final, decision-complete specification.** It specifies Rust/Anchor programs and a React/TypeScript application. This planning pass does not generate product code.
**Parity target:** feature-for-feature with the source repo. See §16.

---

## 0. How to use this document

This is the complete technical description of what has to be built. It is written to be
read in order once, then used as a reference.

- §1–§2 establish what is being ported and what must not change.
- §3 is the architecture decision record. **Read this before writing any code.** Every
  significant fork in the port is recorded here with the reasoning and the rejected
  alternatives, so the decision does not have to be re-litigated in a PR review.
- §4–§13 are the specifications: repo layout, programs, math, off-chain services, client
  SDK, frontend, design, tooling, tests, deployment.
- §14 is the phase plan with acceptance criteria. This is the schedule.
- §15 is the hazard register — the things that are genuinely harder on Solana — and the
  improvement register: the things that get materially better, several of which delete
  features the source repo was still planning to build.
- §16 is the parity checklist. Every file in the source repo appears in it.
- §17 is the **final decision register**. Q1-Q8 are resolved; no architecture fork is waiting on the reader.
- §18 is dated research context. Where an exploratory recommendation there differs from §17, §17 wins.
- §19 is the **post-v1 roadmap**. Everything there is future scope and must not delay or silently enter v1.

`CLAUDE.md` is the companion file: it covers *how to behave* while implementing this.
Where the two disagree, this file wins on **what**, `CLAUDE.md` wins on **how**.

---

## 1. What is being ported

### 1.1 The product

A token launchpad whose organising idea is **private contribution, public settlement.**

While a raise is open, individual contribution amounts are sealed — encrypted on chain,
readable only by the contributor and a designated auditor. When the raise closes, the
operator tallies the sealed amounts off-chain, commits a Merkle root of
`(address, allocation)` pairs, and from that moment every allocation is publicly
verifiable and permissionlessly claimable.

This solves a real problem. On a transparent chain, an open raise leaks a live
leaderboard: a large early contribution invites copy-trading and front-running, and a slow
start becomes self-fulfilling because everyone can watch it being slow. Sealing the round
removes that signal without removing accountability, because the settlement is fully
public.

Secondary surfaces, all present in the source repo and all in scope:

- **Bonding-curve market** — constant-product curve with virtual reserves, so a token has
  a price from its first block. Permissionless, terminal graduation to a real AMM pool at
  a stated target.
- **Fee router** — declarative bps splits over an incoming revenue stream, pull-payment,
  with a one-way `lock()` so contributors can verify the economics cannot be rewritten
  after they buy in.
- **Desks** (`BoardRegistry`) — named curators with a minimum revenue share, so a launch
  can be listed under a desk that vouches for it and is paid for doing so.
- **On-chain social** — comments, follows, watchlists. On chain rather than in a database
  because authorship must remain signed on chain rather than asserted by a backend. The
  history indexer chosen in Q6 is rebuildable and never authoritative for money or authorship.
- **Paid promotion** — time-limited feed placement, priced on chain, so "featured" is a
  verifiable fact rather than a flag a server sets. Placement only; never economics.

### 1.2 What exists in the source repo

| Area | Contents |
|---|---|
| Contracts | 15 Solidity files + 8 subdirectories (`auditor/`, `errors/`, `interfaces/`, `libraries/`, `prod/`, `tokens/`, `types/`, `verifiers/`) |
| Circuits | `circom/`, `zk/`, Solidity verifiers generated via `@solarity/hardhat-zkit` |
| Scripts | 3 suites — `converter/` (10), `ido/` (11 + allocations), `standalone/` (8) — plus 4 build helpers |
| Tests | 11 files, 103 passing |
| Docs | `PRODUCT.md`, `DESIGN.md`, and 5 files under `docs/` including a 100-item ranked feature backlog |
| Frontend | Vite 7 + React 18 + TS + Tailwind 4 + wagmi/viem + RainbowKit; 41 components; **19 route entries (18 addressable + fallback)** |
| Deployed | 2 addresses on Fuji testnet; everything else local chain 31337; nothing on mainnet |

### 1.3 Chain-level deltas that drive the whole port

| | Avalanche C-Chain | Solana |
|---|---|---|
| Unit of deployment | one contract per instance | one program, one account per instance |
| Integer width | `uint256` | `u64` values, `u128` intermediates |
| Decimals | 18 | 6 or 9 |
| Privacy primitive | circom + on-chain verifier + EncryptedERC | Token-2022 confidential transfers + ZK ElGamal Proof Program |
| EVM-style reentrancy | possible; guards required | runtime/account model blocks the classic shape; guards delete, but CPI ordering and account reloads still require review |
| Historical queries | `eth_getLogs` by block range | no equivalent without an indexer |
| Setup flow | 4 sequential contract deploys, partially failable | **3-5 resumable transactions**; no per-launch program deployment, but no unsafe one-transaction promise |
| Finality | ~2s blocks, probabilistic | ~400ms slots, explicit commitment levels |
| Storage cost model | gas, paid once, never refunded | rent, refundable on close |
| Upgradeability | immutable by default | upgradeable by default |

The last row is the one that costs the most design attention, and the fourth-from-last is
the one that costs the most engineering time. See ADR-005 and ADR-006.

---

## 2. Invariants

Carried from the source repo's `PRODUCT.md` and `DESIGN.md`, then strengthened where the
Solana account model creates a new failure mode. These are product and security decisions.
If a task appears to require breaking one, that is an architecture review, not a workaround.

1. **No contribution amount is rendered, aggregated, inferred or logged while a sale is
   open.** Not in the UI, not in a tooltip, not in a program log, not in a debug build.
2. **No figure the chain does not produce.** No client-side vote counts, no holder count
   on a sealed round, no 24h change on a launch younger than a day.
3. **No progress bar without its denominator.**
4. **Splits total exactly 10 000 bps.** Rejected at the instruction boundary otherwise.
5. **Economic locks are one-way and truthful.** Split lock, mint-authority revocation,
   activation, graduation and program immutability cannot be undone by a convenient admin.
6. **Amounts are `u64` at token precision.** Products use checked `u128`; formatted values
   never round-trip into instruction data.
7. **Every write has a pending state and a failed state.** Wallet rejection, blockhash
   expiry, proof-context races and simulation failure are normal outcomes.
8. **Graduation is permissionless and terminal.** Anyone may trigger it after the target;
   reserves cannot fall back to an arbitrary wallet, and the resulting position obeys its
   published liquidity lock.
9. **Promotion buys placement only.** It never touches economics and is labelled.
10. **The design system is a token edit away from any retheme.** See `DESIGN.md`.
11. **The confidential/public boundary is crossed in exactly one program path.**
    Contributions use cUSDC; settlement, fees, markets and DAMM v2 use canonical public
    USDC. A CT mint never reaches a DEX-facing path.
12. **No human-controlled key owns a contribution vault.** The Sale PDA owns it; humans
    may hold viewing/proof material, but every movement is constrained by `norr_claim`.
13. **Every accepted contribution passes through `norr_claim::contribute`.** The Sale vault
    rejects confidential and public credits at rest; the program opens a one-transfer
    atomic gate and commits the accepted transfer to an on-chain hash chain.
14. **No money path is live during setup.** A launch activates only after its split is
    locked, fixed supply is proven, authorities are revoked, vaults are funded/configured,
    dates are valid and external program IDs are pinned.
15. **An immutable value program never trusts a mutable registry for a destination.** Sale,
    Router, wrapper and DAMM bindings are copied into their immutable accounts at creation.
16. **A token-account balance is not an accounting liability.** Unsolicited transfers are
    surplus, never minted claims, curve reserves or wrapper backing obligations.
17. **Every sealed sale has a fixed end and a rehearsed exit.** If normal settlement misses
    its deadline, a timelocked public-refund branch remains available; there is no
    indefinite operator-only lock.
18. **No admin sweep can seize backing, a valid claim or locked liquidity.** Excess recovery
    is bounded by recorded liabilities; claim rights do not expire.

---

## 3. Architecture Decision Record

### ADR-001 — The privacy layer

**Final decision: use Token-2022 Confidential Transfers / Confidential Balances for user
balances and contribution transfers. Do not build a custom Groth16 balance ledger, and do
not silently fall back to one.**

This is the protocol primitive, is deployed on all clusters, removes the bespoke circom
ledger, and keeps standard token-account semantics. P0 is an implementation gate, not an
architecture vote: it verifies the ZK ElGamal Proof Program, clients, proof contexts,
compute and target-cluster feature set. If that gate fails, the private product does not
ship on mainnet until the platform problem is fixed.

Groth16 remains allowed for an isolated statement if a future feature needs it; it is not
a second balance system. Arcium remains a v2 candidate for program-owned confidential
balances and a verifiable tally only after a mainnet-callable adapter proves that the
amount entering MPC is cryptographically the same amount transferred through CT.

**Privacy claim:** CT hides amounts, not participants, account relationships or timing.
Every user-facing sentence must say *amount confidentiality*, never anonymity. See I-32.

### ADR-002 — A wrapped confidential contribution asset (`norr_wrap`)

**Final decision: build a thin audited wrapper for v1, modelled on SPL Token Wrap but with
the auditor policy in ADR-011. Use canonical legacy-SPL USDC first; keep the account model
generic while governance allowlists only explicitly tested underlying mints.**

The official SPL Token Wrap program creates an immutable confidential-transfer config with
no auditor, so it cannot satisfy Q3 unchanged. Reuse its 1:1 PDA escrow pattern, not its
production deployment or every extension choice.

Rules:

- wrapped decimals exactly equal underlying decimals;
- one confidential atomic unit is a liability for one underlying atomic unit;
- production starts with the canonical USDC mint and legacy Token Program only;
- reject transfer-fee, transfer-hook, permanent-delegate, interest-bearing,
  scaled-UI, pausable, freeze-enabled, close-authority or otherwise non-1:1 mints;
- create the cUSDC mint atomically with only `ConfidentialTransferMint`,
  `ConfidentialMintBurn` and the minimum metadata pointer needed by wallets;
- the cUSDC freeze authority, permanent delegate and mint close authority are `None`;
- `wrap` mints exactly the **observed underlying vault delta**, not a caller-supplied amount;
- `unwrap` burns and releases the same atomic amount, with destination/mint constrained;
- record `total_liability`; require `vault.amount >= total_liability`, not equality, because
  anyone can donate SPL tokens directly to a public vault address;
- `recover_excess` may send only `vault.amount - total_liability` to one immutable
  `excess_recipient` after the 72-hour config timelock and a post-transfer solvency check;
- pause stops new wraps only. Unwrap, emergency refund and excess-free solvency recovery
  cannot be paused;
- auditor rotation follows ADR-005/Q3 and historical key epochs remain available.

ConfidentialMintBurn hides the token-side mint/burn amount. The public USDC transfer and
escrow-vault balance still expose each wrap and aggregate backing, so this is amount
confidentiality after wrapping—not end-to-end anonymity. See I-06 and I-32.

Arcium may replace proof generation later behind the same SDK boundary, but v1 has no
announced-code dependency.

### ADR-003 — Six domain programs plus the wrapper

**Final decision: deploy six reusable domain programs plus `norr_wrap`; create one account
set per launch. Never deploy a program per launch and never ship executable bytecode in the
browser.**

The source deploys `IDO`, `FeeRouter`, `ProjectToken` and sometimes `BondingCurve` for each
launch. Solana replaces those instances with PDAs owned by already deployed programs. The
safe creation flow is still a measured, resumable **3-5 transaction** plan because mint,
metadata, cross-program accounts, funding, locking and activation do not have a proven
single-transaction fit. The improvement is no per-launch program deployment—not a false
one-signature promise.

Programs: `norr_launch`, `norr_claim`, `norr_fees`, `norr_market`, `norr_boards`,
`norr_social`, and `norr_wrap`.

Rejected: a mega-program, because it couples upgrade authority across unrelated domains
and makes the immutable-custody boundary in ADR-005 impossible to state honestly.

### ADR-004 — Own the launch curve; graduate into a locked Meteora DAMM v2 position

**Final decision: implement the source constant-product curve in `norr_market`; do not use
Meteora DBC before graduation. Graduate atomically into Meteora DAMM v2.**

DBC would change curve shape, protocol cut, fee ownership and migration surplus rules. The
small Rust curve preserves the source economics, while DAMM v2 replaces the source's
bespoke post-graduation pair.

Both project token and market base token are canonical **legacy SPL Token** mints for the
v1 venue path: fixed-supply project token and canonical USDC. cUSDC never reaches the
curve or DAMM. Every DAMM program/config/mint/vault/position account is pinned and
constrained; `graduated` commits only after the CPI succeeds. If it fails, all state and
reserves roll back and anyone may retry. The source's direct-transfer fallback is deleted.

The DAMM position is created under the Curve PDA, not a creator wallet. V1 enforces
`MIN_LIQUIDITY_LOCK = 180 days`; creators may choose longer or permanent. While locked,
`collect_lp_fees` is permissionless and routes proceeds to the immutable Router split.
After the deadline, only the stored `liquidity_beneficiary` can call `release_position`.
The UI displays the beneficiary and timestamp before a trade. This removes the source path
where the recipient can withdraw graduated liquidity immediately.

Curve reserve division uses ceiling division so integer rounding cannot leak invariant
value to traders; §6.1 is the executable formula.

### ADR-005 — Split immutability by risk, not by repository

**Final decision: revoke upgrade authority on `norr_claim`, `norr_fees`, `norr_market` and
`norr_wrap` before uncapped mainnet value. Keep `norr_launch`, `norr_boards` and
`norr_social` behind 3-of-5 Squads plus a 72-hour timelock.**

Canaries may remain upgradeable under strict caps during audit. Before uncapped value,
publish verified bytes and set the four value-program upgrade authorities to `None`.

The config multisig controls approved contribution mints, cUSDC auditor rotation,
`PromoConfig` and pause-only controls. Pause may stop new wrap/contribution/trade entry;
it can never block unwrap, settle, refund, claim, fee release or LP-fee collection. Unpause
and every non-emergency configuration change wait 72 hours.

Mutable `norr_launch` is discovery/orchestration, not an authority over existing value.
Each Sale, Router, Curve and WrapConfig stores its own immutable mint, vault, destination,
program and authority bindings; no critical instruction re-reads a redirectable address
from Launch. See invariants 14-15 and ADR-012.

The UI reports verified-build status, program upgrade authority, config authority, mint
and freeze authorities, liquidity lock and external DAMM authority separately.

### ADR-006 — Account-first reads plus a rebuildable Helius indexer

**Final decision: current state comes directly from RPC accounts/subscriptions. Historical
series use a self-owned TypeScript indexer fed primarily by Helius LaserStream, persisted
in PostgreSQL, with Triton standard RPC as the independent fallback.**

`apps/indexer` decodes only pinned program IDs through generated clients, stores slot,
signature and instruction index as its idempotency key, and exposes a read-only HTTP API.
LaserStream's 24-hour replay handles short outages; full bootstrap/backfill uses paginated
signatures and transactions from the independent RPC. A clean database must rebuild from
chain and converge byte-for-byte with production fixtures.

The indexer is **never authoritative** for balances, claimability, fee entitlement,
authority posture or transaction construction. Those are read from chain immediately
before signing. It serves candles, activity, notifications, aggregate search and profile
history. If unavailable, those surfaces state that history is unavailable while all
money-moving paths continue.

This knowingly retires the source's "no backend" claim. The better invariant is "no
trusted backend": the database is disposable, the schema is ours, and provider adapters
prevent Helius lock-in.

### ADR-007 — Decimals and integer widths

**Decision: 9 decimals for project tokens, 6 for `cUSDC` (matching USDC). All amounts
`u64`. All products promoted to `u128`. Price as Q64.64 fixed point in `u128`.**

`BondingCurve.priceX18()` computes `effectiveBase() * 1e18 / tokenReserve`. In `u64` this
overflows on essentially any real reserve. This is the most mechanical and most
repetitive porting hazard in the codebase — see §6.1 for the full re-derivation and the
bounds that must be asserted.

### ADR-008 — The accent moves to Solana violet

**Decision: accent becomes `#9945FF` in three measured values. Red is retired to `--loss`
only. Solana green and the purple→green gradient are rejected.**

Full reasoning, measurements and the complete token diff are in `DESIGN.md` and
`tokens.css`. Summary in §10.

### ADR-009 — Settlement plus a bounded public-refund escape

**Final decision: the normal unwrap boundary is the dedicated, incremental and idempotent
`norr_claim::settle` instruction after tally review and before claims open. A separate
post-deadline refund branch is mandatory for v1 liveness.**

State machine:

```
setup (0) -> accepting (1) -> allocation_committed (2) -> settled (3) -> claims_open (4)
                 | after settlement_deadline
                 +-> refund_committed (5) -> refunds_open (6)
```

`finalize` is allowed only after `ends_at`. It commits the allocation root, exact manifest
hash, contribution count/hash-chain head, `total_contributed`, `total_allocated` and
claimant count. A 24-hour review follows. Before any settlement tranche, the 2-of-3 tally
authority may `void_tally` and recommit a corrected root; the clock window stays closed.

`settle` uses only bindings stored in Sale. The Sale PDA signs cUSDC proof/burn/unwrap CPIs
into its stored public-USDC settlement vault. `settled_amount` increases only by the
verified amount that landed. Public USDC stays there until the full committed amount is
unwrapped **and** the project-token vault is funded for `total_allocated`; then one
constrained transfer goes to the stored Router vault and claims may open. No creator is
paid while claim inventory is missing.

If success settlement has not begun by `settlement_deadline = ends_at + 7 days`, the
separate 3-of-5 timelocked emergency authority may commit a refund root whose leaves are
the contributed public-USDC amounts and whose sum equals `total_contributed`. Review is
seven days. `settle_refund` unwraps into the Sale settlement vault; claimants use the same
proof-first ClaimStatus flow to receive public USDC. This emergency branch reveals refund
amounts when claimed, which the UI discloses before contribution. It never routes funds to
the creator or Router.

Normal operations use the 2-of-3 offline proof key. An encrypted disaster-recovery copy is
split 3-of-5 across parties distinct from the tally web service and is exercised quarterly.
If the complete refund drill cannot be demonstrated at P0/P2, private mainnet is blocked.
No claim/refund expires and no admin sweep exists.

### ADR-010 — Confidential keys are derived, versioned and ephemeral

**Final decision: derive each ElGamal keypair from a deterministic wallet signature; never
persist the secret. Treat the confidential balance as a bounded workspace, not long-term
custody.**

Use the official Token-2022 confidential-transfer signer-derived key routine and pin its
canonical message/context, version, cluster genesis hash, wallet pubkey and mint in test
vectors. If the React client needs a JavaScript port, it must reproduce the official Rust
algorithm byte-for-byte; do not invent a new HKDF or reinterpret signature bytes directly.
Ed25519 signatures are deterministic, so the same wallet/message recovers the same key.

At wallet connection, test `signMessage` before showing a confidential action. P0 covers
Phantom, Solflare, Backpack, Mobile Wallet Adapter and named hardware wallets. The client
tries all historical domain versions and offers a sweep before adopting a newer one.
Secrets never enter localStorage, analytics, crash reports, logs or the indexer.

The workspace is not an immediate same-amount pass-through: doing `wrap(X)` followed by
`contribute(X)` makes X inferable. Offer standard top-up denominations, encourage time
separation, show a correlation warning, cap the recommended resting balance, and sweep
residue after settlement. This reduces exposure but cannot turn amount confidentiality
into anonymity. Wallet loss still loses access; the auditor can view but never spend.
`/private` remains for route parity, but its visible name becomes **Private workspace**.

### ADR-011 — Threshold-attested tally with an on-chain accepted-transfer commitment

**Final decision: v1 uses a transparent 2-of-3 operator tally; custody is programmatic but
tally correctness and proof-key liveness remain threshold-trusted. Arcium is v2.**

Every successful `contribute` increments `Sale.contribution_count` and extends
`Sale.contribution_chain_hash` over a domain-separated descriptor bound to the validated
Token-2022 ciphertext-validity context. The event emits ordinal, contributor, source token
account, auditor epoch and entry hash—never an amount. Direct credits are disabled, so this
is the complete accepted sequence rather than a best-effort index.

The canonical manifest contains cluster genesis hash, program and Sale IDs, contribution
count and chain head, accepted transaction references/entry hashes, algorithm version,
auditor epochs, decrypted contributions, allocations, roots and totals. Two independent
operators reproduce it byte-for-byte; two of three approve `finalize`. Sale stores the
manifest hash. The review delay is actionable because `void_tally` exists before the first
settlement tranche, and the bounded refund branch in ADR-009 exists if settlement stalls.

Roles are protocol operations, independent security/audit, and legal/compliance. Auditor
and vault proof material are distinct. Normal private material uses 2-of-3 offline custody;
a separate encrypted 3-of-5 disaster-recovery set exists only for the timelocked refund
runbook. No browser, indexer, analytics service or shared CI worker receives a secret.

Arcium becomes eligible only after the §19 gates prove same-amount CT-to-MPC binding,
deterministic callbacks and a refund independent of Arcium liveness.

### ADR-012 — Setup is not a live launch

**Final decision: all domain accounts begin inert and one `norr_launch::activate` transition
opens money movement only after a complete on-chain checklist.**

Activation verifies:

- the project mint is legacy SPL Token, 9 decimals, expected fixed supply, mint authority
  `None`, freeze authority `None`, no delegate/close extension, and metadata hash matches;
- Router splits total 10,000 bps, are locked, have never received funds, and satisfy the
  snapshotted desk terms;
- every stored Sale/Curve/Router/wrapper mint, vault, owner and program ID agrees;
- a sealed sale has `ends_at > starts_at`, duration at most 30 days, and a fixed settlement
  deadline; its CT vault rejects both credit types at rest;
- a curve has its exact inventory, immutable fee, graduation target, beneficiary and at
  least the 180-day position lock;
- the launch creator and project metadata are final for the activation transaction.

`Launch.flags.active` is one-way. `Sale` moves setup->accepting; Curve sets `active=true`.
Contribute/buy/sell all require this state. Feed entries created during a resumable setup
are labelled **setup incomplete** and excluded from ranked/live lists. This prevents users
from entering while a creator can still change splits, mint supply or inventory.

---

---

## 4. Target repo layout

```
norr-fun-solana/
  Anchor.toml
  Cargo.toml                      workspace
  package.json                    pnpm workspace root
  CLAUDE.md                       agent operating rules
  PLAN.md                         this file
  PRODUCT.md                      ported, amended per ADR-001/006
  DESIGN.md                       ported, accent per ADR-008
  README.md
  .env.example

  programs/
    norr-launch/                  create + register launches; resumable setup coordinator
    norr-claim/                   sealed sale -> Merkle settlement -> claim
    norr-fees/                    bps splits, pull payment, one-way lock
    norr-market/                  bonding curve + graduation CPI
    norr-boards/                  desks
    norr-social/                  comments, follows, watchlist, promotion
    norr-wrap/                    confidential asset wrapper (ADR-002)

  packages/
    sdk/                          Codama clients, PDA derivation, math mirror
    confidential/                 CT orchestration: keys, proofs, multi-tx
    tally/                        deterministic tally + manifest + Merkle proofs
    metadata/                     Irys upload, URI/hash validation

  apps/
    web/                          Vite 7 + React 18 + TypeScript frontend
    cli/                          the scripts/ suites, as commands
    indexer/                      TypeScript + LaserStream + PostgreSQL + read-only API

  deployments/                    generated per-cluster manifests consumed by CLI/web
  tests/                          Rust unit + Anchor integration (TypeScript)
  docs/
    FEATURES.md                   100-item backlog, re-scored for Solana
    TESTPLAN.md
    launchpad-functional-spec.md
    confidential-transfers.md     new: the CT flow, keys, failure modes
    indexing.md                   new: the ADR-006 exception, stated plainly
    parity.md                     §16 checklist, as a living document
  scripts/
    localnet.sh  e2e-local.sh  run_all_devnet.sh  verify.sh
```

Not present, deliberately: `circom/`, `zk/`, `contracts/verifiers/`, any generated
verifier, any proving-key artifact, and any file shipping program bytecode to the browser.

---

## 5. Program specifications

### 5.0 Shared conventions

**Account layout rule (load-bearing, see ADR-006).** Every account places fixed-size,
filterable fields immediately after the 8-byte discriminator, and every variable-length
field last. `memcmp` offsets must be stable forever, so field order is part of the ABI.

**Space declaration.** Each account struct carries a `LEN` const with the arithmetic
written out. No `size_of`.

**PDA seed table.** Every seed in the system, in one place. Seeds are max 32 bytes each,
which is why a desk slug capped at 32 bytes can be used raw as a seed — a convenient
coincidence with the source repo's existing `MAX_SLUG_LENGTH = 32`.

| PDA | Seeds | Program |
|---|---|---|
| `Launch` | `b"launch"`, `project_mint` | norr_launch |
| `Sale` | `b"sale"`, `launch` | norr_claim |
| `ClaimStatus` | `b"claim"`, `sale`, `claimant` | norr_claim |
| `Router` | `b"router"`, `launch` | norr_fees |
| `RouterVault` | ATA of `asset_mint` owned by `Router` | norr_fees |
| `Curve` | `b"curve"`, `project_mint` | norr_market |
| `CurveTokenVault` | `b"ctok"`, `curve` | norr_market |
| `CurveBaseVault` | `b"cbase"`, `curve` | norr_market |
| `Board` | `b"board"`, `slug` (<=32 bytes, raw) | norr_boards |
| `Thread` | `b"thread"`, `subject` | norr_social |
| `Comment` | `b"comment"`, `subject`, `index_u32_le` | norr_social |
| `Follow` | `b"follow"`, `follower`, `target` | norr_social |
| `Saved` | `b"saved"`, `account`, `subject` | norr_social |
| `Profile` | `b"profile"`, `wallet` | norr_social |
| `SubjectStats` | `b"subject"`, `subject` | norr_social |
| `Promo` | `b"promo"`, `subject` | norr_social |
| `PromoConfig` | `b"promo_config"` | norr_social |
| `WrapMint` | `b"cmint"`, `underlying_mint` | norr_wrap |
| `WrapVault` | `b"cvault"`, `underlying_mint` | norr_wrap |

**Error names port 1:1 from the Solidity custom errors** so existing docs and tests stay
readable: `NotOwner`, `AlreadyFinalized`, `NotStarted`, `Ended`, `InvalidProof`,
`NothingToClaim`, `AlreadyLocked`, `NoSplits`, `BpsMustTotalDenominator`, `ZeroRecipient`,
`ZeroBps`, `ZeroAmount`, `NothingToRelease`, `NotARecipient`, `ZeroAddress`,
`AlreadyGraduated`, `SlippageExceeded`, `InsufficientReserve`, `FeeTooHigh`, `NotReady`,
`SlugTaken`, `EmptyField`, `SlugTooLong`, `ShareTooHigh`, `NotBoardOwner`, `UnknownBoard`,
`AlreadyRegistered`, `OutOfRange`, `NotAllowedOnBoard`, `BoardShareTooLow`,
`CannotFollowSelf`, `AlreadyFollowing`, `NotFollowing`, `AlreadySaved`, `NotSaved`,
`EmptyBody`, `BodyTooLong`, `NotAuthor`, `AlreadyHidden`, `UnknownTier`, `TierInactive`,
`WrongPayment`.

New errors the platform requires: `MathOverflow`, `BoundsExceeded`, `WrongTokenProgram`,
`ConfidentialNotEnabled`, `PendingCreditsFull`, `AuditorMismatch`, `VaultNotEmpty`,
`ClusterMismatch`, `NotActive`, `DirectCreditsEnabled`, `ContextMismatch`,
`SettlementDestinationMismatch`, `Insolvent`, `RefundNotReady`, `UnsafeMintAuthority`,
`UnsupportedExtension`, `LiquidityLocked`, `ContributionSequenceMismatch`.

**`ZeroRecipient`/`ZeroAddress` mostly disappear** — an Anchor `Account<'info, T>` cannot
be the default pubkey and still deserialize. Keep the errors where a raw `Pubkey` is
accepted as instruction data.

**Every mutating instruction emits an Anchor event.** Names port 1:1. Note that these are
logs, and per ADR-006 they are *not* range-queryable — they exist for indexer ingestion
and for transaction-level confirmation, not for historical reconstruction by the client.

---

### 5.1 `norr_launch`

Coordinates deterministic launch accounts and resumable setup. It is discovery and
orchestration; after activation, value programs trust their own stored bindings.

**Account: `Launch`**

| Field | Type | Notes |
|---|---|---|
| `creator` | `Pubkey` | filterable |
| `board` | `Pubkey` | default = no desk |
| `project_mint` | `Pubkey` | fixed-supply legacy SPL mint |
| `contribution_mint` | `Pubkey` | approved cUSDC for raises; USDC for instant market |
| `sale` | `Pubkey` | Sale PDA or default |
| `router` | `Pubkey` | Router PDA |
| `curve` | `Pubkey` | Curve PDA or default |
| `model` | `u8` | 0 instant market, 1 sealed raise |
| `created_at` | `i64` | |
| `flags` | `u8` | bit 0 active, bit 1 tally committed, bit 2 graduated, bit 3 split locked |
| `metadata_hash` | `[u8; 32]` | SHA-256 of immutable Irys metadata bytes |
| `name` | `String` | <=64 UTF-8 bytes |
| `symbol` | `String` | <=16 UTF-8 bytes |
| `uri` | `String` | <=200 bytes, never a data URI |

`LEN = 8 + 32*7 + 1 + 8 + 1 + 32 + (4+64) + (4+16) + (4+200) = 566`.
The fixed prefix ends at offset 274; creator offset 8 and board offset 40 stay stable.

**Instructions**

| Instruction | Does |
|---|---|
| `create_instant` | creates inert Launch/Router/Curve accounts after validating mint and metadata inputs |
| `create_raise` | creates inert Launch/Router/Sale accounts with immutable wrapper/settlement bindings |
| `attach_board` | snapshots owner/min-bps terms before activation; future board changes affect new launches only |
| `set_uri` | creator-only during setup; post-activation changes require governed policy and update URI+hash together |
| `activate` | performs ADR-012 checklist and atomically opens Sale or Curve; one-way |

**Client transaction plan: measured, resumable, initial budget 3-5 transactions**

1. Upload image/metadata to Irys; verify bytes, URI and SHA-256 locally.
2. Create the legacy-SPL project mint/metadata, mint exact supply, distribute setup
   inventory, then revoke mint and freeze authorities.
3. Initialize deterministic domain accounts and store every immutable binding.
4. Fund claim/curve inventory and lock Router splits; split only if measured size/CU
   requires it.
5. Simulate and submit `activate`; read back every authority/state before marking live.

Persist completed signatures and derived addresses under a hash of all inputs. Reload
verifies each account from finalized RPC state. A valid but inactive Launch is recoverable
and visible as setup incomplete, never as an accepting sale. Do not optimize transaction
count by deleting this barrier.

### 5.2 `norr_claim`

Ports `IDO.sol`, adds program custody, complete contribution commitment and a bounded
refund state machine.

**Account: `Sale`**

| Field | Type | Notes |
|---|---|---|
| `launch` | `Pubkey` | identity only; never a settlement destination source |
| `tally_authority` | `Pubkey` | 2-of-3 Squads vault |
| `emergency_authority` | `Pubkey` | separate 3-of-5 timelocked Squads vault |
| `project_mint` | `Pubkey` | fixed-supply legacy SPL mint |
| `contribution_mint` | `Pubkey` | cUSDC Token-2022 mint |
| `vault` | `Pubkey` | CT account owned by Sale PDA; both credit flags false at rest |
| `token_vault` | `Pubkey` | project claims |
| `router` | `Pubkey` | immutable successful-settlement destination |
| `wrap_config` | `Pubkey` | immutable cUSDC/USDC binding |
| `settlement_mint` | `Pubkey` | canonical public USDC |
| `settlement_vault` | `Pubkey` | public USDC ATA owned by Sale PDA |
| `starts_at` / `ends_at` | `i64` | fixed; end required |
| `merkle_root` | `[u8; 32]` | allocation or refund root by state |
| `tally_manifest_hash` | `[u8; 32]` | exact canonical manifest |
| `contribution_chain_hash` | `[u8; 32]` | ordered accepted-transfer commitment |
| `settlement_not_before` | `i64` | review deadline for committed root |
| `settlement_deadline` | `i64` | `ends_at + 7 days` |
| `total_contributed` | `u64` | cUSDC/USDC atomic units committed by tally |
| `total_allocated` | `u64` | project units, or USDC units in refund mode |
| `total_claimed` | `u64` | units in the active root |
| `settled_amount` | `u64` | USDC successfully unwrapped into settlement vault |
| `contribution_count` | `u32` | accepted `contribute` calls |
| `claimant_count` | `u32` | committed leaves |
| `tally_revision` | `u32` | increments on commit/void |
| `state` | `u8` | 0 setup, 1 accepting, 2 allocation committed, 3 settled, 4 claims open, 5 refund committed, 6 refunds open |
| `bump` | `u8` | |

`LEN = 8 + 32*11 + 8*2 + 32*3 + 8*2 + 8*4 + 4*3 + 1 + 1 = 534`.

**Account: `ClaimStatus`** — fields `sale`, `claimant`, `allocation`, `claimed`, `bump`;
`LEN = 8 + 32 + 32 + 8 + 8 + 1 = 89`. Claimant signs and pays; close returns rent to the
same claimant. No redundant `fully_claimed` bit can drift from the counters.

**Instructions**

| Instruction | Rule |
|---|---|
| `initialize` | stores all immutable bindings; configures vault with both credit flags false; state setup |
| `activate` | callable only through validated `norr_launch`; ADR-012 checks; state accepting |
| `contribute` | inside window: enable confidential credits, execute exactly one validated CT transfer CPI, disable credits, append hash-chain entry, emit amount-free receipt |
| `apply_pending` | Sale-PDA-signed keeper action with expected-counter concurrency check |
| `finalize` | after end, 2-of-3; commits success root/manifest/count/chain/totals and 24h review |
| `void_tally` | 2-of-3, before first settlement tranche; clears root/totals and increments revision |
| `fund` | deposits project tokens; claims cannot open until exact committed inventory is present |
| `settle` | after review; incrementally unwraps to Sale settlement vault; routes only after full total and funding |
| `commit_refund` | 3-of-5 timelocked, after settlement deadline and before success settlement; commits refund root with 7d review |
| `settle_refund` | incrementally unwraps to Sale settlement vault; never Router; opens refunds only at full total |
| `open_claim` | claimant-signed; verifies domain-separated allocation/refund proof **before** account creation commits and stores allocation |
| `claim` | no proof repeat; pays only claimant's canonical ATA for the state-selected mint |
| `close_claim_status` | after full claim/refund, returns rent to claimant |
| `close_sale` | only after all committed units claimed, every context closed and all liabilities/vaults reconciled; no sweep |

The CT vault rejects direct transfers outside `contribute`. The instruction temporarily
enables confidential credits, invokes one transfer, and disables them in the same atomic
transaction; a failure rolls the entire gate back. Non-confidential credits are always
disabled. Proof-context owner, discriminator/type, source/destination keys, destination
ElGamal key, auditor handle, ciphertext commitment and close authority are constrained.

The accepted-entry hash is:

```
entry = keccak("norr-contribution-v1" || sale || ordinal_le || contributor ||
               source_ct_account || auditor_epoch_le || validated_ciphertext_context_hash)
chain = keccak(previous_chain || entry)
```

The amount remains encrypted. `finalize` requires the supplied count/head to equal Sale.

`ends_at` is mandatory, greater than `starts_at`, and no more than 30 days later. The UI
never shows accepting state from wall-clock time alone; it reads Sale state plus finalized
cluster time. Refund amounts become public only in the emergency branch, with advance copy.

### 5.3 `norr_fees`

Pull-payment bps splits with a one-way pre-activation lock and monotonic per-deposit
accrual.

**Account: `Router`**

| Field | Type | Notes |
|---|---|---|
| `launch` / `authority` / `asset_mint` / `vault` | `Pubkey` | asset is canonical public USDC for raises |
| `total_received` / `total_released` | `u64` | checked cumulative accounting |
| `locked` | `bool` | one-way, required before activation |
| `split_count` | `u8` | 1..8 |
| `splits` | `[Split; 8]` | fixed-size direct read |
| `bump` | `u8` | |

`Split = { recipient: Pubkey, bps: u16, category: u8, accrued: u64, released: u64 }`
= 51 bytes. `LEN = 8 + 32*4 + 8 + 8 + 1 + 1 + 8*51 + 1 = 563`.

`set_splits` rejects duplicates, zero entries, bad total, `locked=true` or
`total_received != 0`. `lock` is one-way. ADR-012 prevents every contribution/trade until
lock is observed by the relevant immutable program.

A direct token transfer cannot notify Router, so `sync` computes only the unrecognized
delta:

```
tracked_balance = total_received - total_released
new_received = vault.amount - tracked_balance
```

It then allocates **that delta**, not the lifetime total. Floors go to all splits except the
largest-bps split (lowest canonical index on ties), which receives the per-batch remainder.
Each `accrued` value is monotonic and the sum increases by exactly `new_received`.
`releasable = accrued - released`. This replaces the earlier cumulative-entitlement plus
`sweep_dust` design, whose remainder entitlement could move backward as several floors
crossed at once. There is no dust sweep and no unowned lamport.

`release` is permissionless but pays only the stored recipient ATA. `release_all` accepts
at most eight recipient ATAs and validates every remaining account. Market fees and
successful sale proceeds transfer directly to the vault; `sync` may be called in the same
transaction or at the start of release. Confidential assets are rejected.

### 5.4 `norr_market`

Ports the source virtual-reserve constant-product curve and graduates into a locked
Meteora DAMM v2 position.

**Account: `Curve`**

| Field | Type | Notes |
|---|---|---|
| `launch`, `project_mint`, `base_mint`, `token_vault`, `base_vault`, `router` | `Pubkey` | all immutable bindings |
| `liquidity_beneficiary` | `Pubkey` | receives position only after lock |
| `damm_position` | `Pubkey` | default until successful graduation |
| `virtual_base`, `base_reserve`, `token_reserve`, `graduation_target` | `u64` | internal liabilities, never raw vault balances |
| `fee_bps` | `u16` | <=1000 and immutable at activation |
| `active` / `graduated` | `bool` | one-way transitions |
| `created_slot`, `max_buy_first_slots` | `u64` | anti-snipe window |
| `liquidity_unlock_at` | `i64` | at least activation +180 days |
| `bump` | `u8` | |

**Instructions:** `initialize`, `activate`, `buy`, `sell`, `graduate`,
`collect_lp_fees`, `release_position`. Configuration changes stop at activation.

Behavior:

- `k = (virtual_base + base_reserve) * token_reserve` in checked `u128`;
- buy/sell reserve division uses `ceil_div`, and outputs round down in pool favor;
- sell gross is capped by real `base_reserve`, never virtual liquidity;
- vault donations never modify reserves or quotes; terminal excess recovery is bounded and
  cannot touch tracked reserves;
- `graduate` is permissionless, terminal only after DAMM CPI success and has no transfer
  fallback;
- the Curve PDA owns the DAMM position until `liquidity_unlock_at`;
- position fees route through Router while locked; only stored beneficiary receives the
  position after unlock.

Project/base mints are fixed-supply/canonical legacy SPL Token mints. Every token program,
DAMM program/config and vault is pinned and validated. §6.1 defines exact rounding and
decimal conversion.

### 5.5 `norr_boards`

Ports `BoardRegistry.sol`. This is where Solana's PDA model deletes the most code.

**Account: `Board`** — `owner`, `min_bps: u16` (<= `MAX_PARTNER_BPS = 5000`),
`launch_count: u32`, `created_at: i64`, `allowlist_only: bool`, `slug: String` (<=32,
immutable), `name: String` (<=64), `uri: String` (<=200).

**What deletes.** Uniqueness and lookup by slug are the PDA itself:
`Board` is seeded on the slug, so `_idBySlug`, the `SlugTaken` error path, the
burned-index-0 sentinel, and the whole "boardId 0 means no board" convention are replaced
by *does this PDA exist*. Atomically, for free, with no possible race. `MAX_SLUG_LENGTH =
32` survives unchanged because 32 bytes is exactly the seed limit.

**Instructions:** `create_board`, `update_board` (slug immutable, mirroring the source),
`set_min_bps`, `set_allowlist_only`, `allow_creator` / `disallow_creator`
(`Allowlist` PDA seeded `b"allow"`, `board`, `creator`).

`NotAllowedOnBoard` and `BoardShareTooLow` are enforced in `norr_launch::attach_board`.

---

### 5.6 `norr_social`

Ports `LaunchComments.sol`, `SocialGraph.sol`, `Promotion.sol`. Merged because they share
the `Profile` counters and are always read together by the feed.

**`Thread`** — `subject`, `next_index: u32`, `count: u32`.
**`Comment`** — `subject`, `author`, `posted_at: i64`, `index: u32`,
`parent_index: u32` (`u32::MAX` = root), `hidden: bool`, `body: String` (<=1000).
`LEN = 8+32+32+8+4+4+1+4+1000 = 1093`. Validate parent belongs to the same
thread and predates the reply. Render one visual indentation level, matching the source UI.
**`Profile`** — `wallet`, `follower_count`, `following_count`, `saved_count`, `post_count`,
all `u32`.
**`SubjectStats`** — `subject`, `save_count: u32`.
**`Follow`** / **`Saved`** — marker PDAs, ~80 bytes each.
**`Promo`** — `subject`, `promoted_until: i64`, `tier: u8`.
**`PromoConfig`** — `authority`, `treasury`, `tier_count: u8`, `tiers: [Tier; 8]`
where `Tier = { price_lamports: u64, duration: i64, active: bool, name: [u8; 16] }`.

**Behaviour preserved:**

- Reply threading moves from the source UI's `↪#<index>` body marker into the typed
  `parent_index` field. Strip legacy markers during import; never count the marker against
  the 1000-character visible-body cap.
- `hide` flags and blanks the body rather than deleting the account, for the same reason
  the source gives: removing it would shift indices and break any link that referenced
  one, and the original text is in chain history regardless, so pretending otherwise would
  be dishonest. Keep the comment; keep the reasoning.
- Counters are stored, not derived. The source's rationale — a follower count is read on
  nearly every profile render and deriving it would grow unbounded — is equally true here,
  and more so because there is no `getLogs` to derive from.
- Promotion time extends from `max(now, promoted_until)`, so buying twice stacks rather
  than silently discarding the remainder.
- Anyone may promote any subject. The source's reasoning holds: a desk promoting a project
  it backs is legitimate, and the only effect is placement.
- A free `Standard` tier exists at index 0, so an unpromoted launch is a choice rather
  than an absence and the tier list is never empty.
- `savedMany` / `followsMany` / `promotedMany` batch reads become a single
  `getMultipleAccounts` on derived PDAs — no program instruction needed at all, and no
  round-trip per subject.

**Payment:** `promote` transfers lamports via the system program instead of
`treasury.call{value:}`, so `TransferFailed` cannot occur.

**Cost note:** every comment is 1093 bytes, about 0.0083 SOL of rent. At scale this is
the single most expensive part of the system, and it is the strongest candidate for ZK
compression — see §15 IMP-08. Design the account now so it can be compressed later:
no self-referential pointers, no dependence on account address for ordering.

---

### 5.7 `norr_wrap`

A minimal immutable escrow wrapper for approved 1:1 assets.

**Account: `WrapConfig`**

`underlying_mint`, `confidential_mint`, `underlying_token_program`, `vault`,
`config_authority`, `ct_mint_authority`, `excess_recipient` (seven Pubkeys),
`auditor_elgamal_pubkey: [u8; 32]`, `auditor_epoch: u32`, `total_liability: u64`,
`paused: bool`, `bump: u8`.

`LEN = 8 + 32*7 + 32 + 4 + 8 + 1 + 1 = 278`.

**Instructions:** `initialize`, `wrap`, `unwrap`, `rotate_auditor`, `set_paused`,
`recover_excess`.

`initialize` verifies the strict ADR-002 extension/authority allowlist and creates every CT
extension atomically. `wrap` measures the underlying vault delta and confidentially mints
that exact amount. `unwrap` confidentially burns and releases the same amount. Both use
validated proof contexts and checked liability updates.

The solvency invariant is `underlying_vault.amount >= total_liability`. Direct donations
are excess, not liabilities. `recover_excess` sends only the mathematically proven excess
to the immutable recipient and rechecks solvency after CPI. Pause never blocks unwrap or a
Sale refund. Auditor rotation affects future transfers; manifests retain every epoch.

The official no-auditor wrapper is not used. Public wrap transfers and vault backing remain
visible, so correlation warnings and time/denomination separation remain product rules.

## 6. Math specification

### 6.1 The curve, re-derived for `u64`

Reserves/amounts are `u64`; products are checked `u128`. Project token has 9 decimals and
public USDC has 6. At initialize and after every state transition:

```
effective_base = virtual_base + base_reserve <= 2^63
token_reserve <= 2^63
k = u128(effective_base) * u128(token_reserve) <= 2^126
```

**Exact pool-favoring reserve division:**

```
ceil_div(n, d) = n / d + (n % d != 0 ? 1 : 0)

buy:
  fee = floor(base_in * fee_bps / 10_000)
  net = base_in - fee
  k = effective_base * token_reserve
  new_token_reserve = ceil_div(k, effective_base + net)
  tokens_out = token_reserve - new_token_reserve

sell:
  k = effective_base * token_reserve
  new_token_reserve = token_reserve + tokens_in
  new_effective_base = ceil_div(k, new_token_reserve)
  gross = min(effective_base - new_effective_base, base_reserve)
  fee = floor(gross * fee_bps / 10_000)
  base_out = gross - fee
```

The old “floor division is always pool-favoring” sentence was wrong: flooring the new
reserve increases trader output. Ceiling division makes post-trade reserve product at least
the pre-trade invariant and changes source output by at most one atomic reserve unit.

**Price:** Q64.64 stores base atoms per project atom:

```
price_q64 = (u128(effective_base) << 64) / token_reserve
```

The SDK must account for unequal decimals. Human USDC per whole project token is the exact
rational `price_q64 * 10^9 / (2^64 * 10^6)`; formatting happens only after this conversion.
Never treat raw Q64.64 as equal-decimal price.

`MIN_TOKEN_RESERVE = 1_000` project atomic units (0.000001 token) and
`MIN_VIRTUAL_BASE = 1` USDC atomic unit. The earlier text simultaneously fixed 1,000 and
said to re-derive it later; this resolves that contradiction. Tests attack the exact floor,
zero denominator, max bounds and one-atom trades.

Slippage args are integers computed from a fresh simulated quote. UI slippage must be
finite and constrained to 0..5,000 bps; stale quotes are expected failures.

### 6.2 Fee splits

Allocation happens when a new vault delta is recognized, not from a recomputed lifetime
entitlement:

```
for every non-remainder split i:
  add_i = floor(new_received * bps_i / 10_000)
remainder_add = new_received - sum(add_i)
accrued_i += add_i
releasable_i = accrued_i - released_i
```

Products use checked `u128`, outputs fit `u64`, and sum of accrued deltas equals the exact
recognized amount. Remainder recipient is the largest bps, tie-broken by canonical split
index. `accrued` never decreases, so prior releases cannot create an underflow after a
future deposit. Splits total exactly 10,000 bps and lock before activation.

### 6.3 Merkle proofs

Use domain-separated **double-hashed** leaves. Do not retain the source's bare
`keccak(address || amount)` or rely on accidental 40-byte/64-byte length asymmetry.

```
allocation_preimage = "norr-claim-v1" || norr_claim_program_id || sale ||
                      project_mint || claimant || allocation_u64_le
allocation_leaf = keccak(keccak(allocation_preimage))

refund_preimage = "norr-refund-v1" || norr_claim_program_id || sale ||
                  settlement_mint || claimant || refund_u64_le
refund_leaf = keccak(keccak(refund_preimage))
```

Program ID, Sale, mint, kind, claimant and amount are all bound. Hardcoded Rust/TypeScript
vectors cover both domains and fail if byte order or encoding changes.

Internal nodes remain sorted pairs:
`keccak(min(left,right) || max(left,right))`. `merkletreejs` remains usable for node
construction; only the leaf builder is replaced. Depth is capped at 20 (640 proof bytes).
Use the Solana keccak syscall and assert transaction size at depth 20. `open_claim` verifies
once and stores the allocation; `claim` does not carry the proof again.

---

## 7. Off-chain services

The product has one rebuildable read service and two operator tools. None is trusted for
balances, authorization or transaction construction.

### 7.1 `apps/indexer` — history, search and notifications

TypeScript service using Helius LaserStream as primary ingest, Triton RPC for independent
backfill, PostgreSQL for disposable materialized views, and a read-only HTTP API. It
indexes pinned program IDs and DAMM v2 market events. Idempotency key is
`(slot, signature, instruction_index, inner_index)`. It checkpoints finalized slots,
handles forks above that checkpoint, replays short gaps, and can rebuild from genesis.

Serves candles, fills, activity, notifications, search, aggregate protocol figures and
profile history. Present balances, claimability and fee entitlement always come from RPC.
The React app has explicit degraded states for every indexer-backed panel.

### 7.2 `packages/tally` — deterministic threshold-attested settlement

Replaces manual allocation files and every source decryptor.

1. Read only finalized `ContributionAccepted` entries for the stored program/Sale.
2. Recompute ordinal continuity and the on-chain contribution hash-chain head.
3. Decrypt each validated auditor handle in an isolated offline environment; aggregate
   multiple contributions per claimant with checked `u128`, then narrow to proven `u64`.
4. Apply the versioned allocation/refund policy using integer arithmetic.
5. Build domain-separated roots per §6.3.
6. Emit canonical JSON (JCS), content hash, count, chain head, epochs, references, totals,
   roots and per-claimant proofs to content-addressed storage.
7. A second independent operator repeats from chain and byte-compares output.
8. Two of three approve success finalization; emergency refund uses its separate 3-of-5
   timelocked authority after the deadline.

The CLI gives each claimant a locally verifiable receipt: accepted ordinal/entry hash,
manifest inclusion, decrypted contributed total and final allocation. Open-sale plaintext
never enters shared logs, analytics, indexer columns or CI artifacts.

### 7.3 `packages/confidential` — CT orchestration

Implements official signer-derived ElGamal/AES keys, capability checks, CT account
configuration, wrap/apply/transfer/burn/withdraw plans, proof contexts and versioned key
sweeping. Secrets are memory-only and zeroized where the runtime permits.

Every proof-context plan validates and records:

- exact ZK ElGamal Proof Program owner and proof discriminator/type;
- source/destination token accounts, mint and Token-2022 program;
- source, destination and auditor ElGamal handles embedded in the verified context;
- equality/range/ciphertext-validity relationships required by the operation;
- expected destination credit flags and auditor epoch;
- context close authority and payer/refund destination;
- single-use consumption and close-on-success/failure behavior.

A context verified for another sale, mint, transfer kind or ciphertext is rejected. Plans
are resumable by public signature/context addresses only. Cleanup discovers abandoned
contexts by payer and closes only those whose authority matches; it never stores a secret.

### 7.4 Pending-balance keeper and key-liveness runbook

Incoming accepted transfers consume pending-credit capacity. The keeper reads both
`pending_balance_credit_counter` and `maximum_pending_balance_credit_counter`, applies well
before a measured low-water mark, and passes the exact expected counter. If actual and
expected differ, it refetches/decrypts/rebuilds instead of overwriting
`decryptable_available_balance` with stale data.

The Sale PDA owns and signs the apply CPI; offline operators supply correctly encrypted AES
material and proofs. At rest, both credit flags remain false. Keeper metrics contain only
counter, age, slot, attempt and status—no ciphertext/plaintext or keys.

Normal vault proof material is 2-of-3 offline. Encrypted 3-of-5 disaster-recovery shares
are stored by distinct custodians, inventoried without secret exposure and exercised on a
funded test sale quarterly. The drill covers counter reconciliation, full unwrap, refund
root, claimant payment and context/rent cleanup. Loss of both threshold sets is an explicit
residual risk and blocks uncapped operation if the drill fails.

## 8. Client SDK (`packages/sdk`)

Replaces `typechain-types/`, `contracts/abis.ts` and `contracts/bytecode.ts`. The
source deployment artifacts are **transformed, not deleted**, into generated per-cluster
manifests consumed by the SDK, CLI and React app.

| Module | Contents |
|---|---|
| `generated/` | Codama clients from the seven Anchor IDLs. Never hand-written. |
| `pda.ts` | **Every** PDA derivation in the system. No `findProgramAddressSync` outside this file. |
| `math.ts` | Mirror of §6: ceiling-rounded curve quotes, per-delta split accrual, unequal-decimal price formatting and both Merkle domains. Property-tested against programs. |
| `queries.ts` | `getProgramAccounts` filters with the memcmp offsets from §5.0, plus `dataSlice` variants for list views. |
| `subscribe.ts` | `accountSubscribe` wrappers with per-figure coalescing (see §10, the `.ticked` note). |
| `cluster.ts` | Genesis-hash-based cluster identity; never trust a display name alone. |
| `deployments.ts` | Validated generated manifest: program IDs, mints, external venue IDs, auditor epochs and source commit. No address text field in the UI. |
| `metadata.ts` | Irys upload, MIME/size validation, content hash and URI verification. Never inline a data URI into `Launch`. |
| `errors.ts` | Anchor error code to human string, from the IDL. Powers the toast copy. |
| `tx.ts` | Versioned transactions, ALT management, compute-budget setting, simulate-before-sign, retry on blockhash expiry. |

**`tx.ts` is where a lot of the UX quality lives.** `simulateTransaction` returns logs,
consumed compute units and the program error — so the source repo's backlog items for a
pre-signature cost estimate, a price-impact warning and a decoded revert reason all become
accurate rather than approximate. Build it once, centrally.

---

## 9. Frontend port map

Stack change: **wagmi/viem + RainbowKit + ethers → `@solana/kit` + wallet-adapter +
Codama clients.** Vite 7, React 18, TypeScript, Tailwind 4, react-router all stay. The
`buffer`/`process`/`util` polyfill aliases in `vite.config.ts` stay — still needed.

### 9.1 Routes

All 19 route entries port unchanged in shape. The chain-scoped mirrors change meaning:
`/:chain/raise/:ido` becomes `/:cluster/raise/:sale`, and `ChainGuard` checks the
connected RPC's cluster rather than a wallet chain id — wallets do not expose a
"wrong network" state the way EVM wallets do (§15 I-09).

```
/                      Feed
/raise/:sale           LaunchDetail
/start                 LaunchModels
/start/instant         CreateLaunch mode=instant
/start/raise           CreateLaunch mode=full
/desks                 Boards
/desk/:slug            BoardDetail
/portfolio  /compare  /owed  /activity  /me  /u/:address  /private  /settings
/:cluster/raise/:sale  /:cluster/desk/:slug  /:cluster/u/:address
```

The three-route wizard stays three routes, for the reason the source comment gives: a
chosen model should be a place you can link to and go back from.

### 9.2 Components

All 41 components plus `components/ui/` are ported. Effort is concentrated in ten.

| Component | Change | Effort |
|---|---|---|
| `CreateLaunch` | **Rewrite construction, preserve progress/resume.** Budget 3-5 measured transactions; verify fixed mint/freeze authorities, locked splits, funding, metadata hash and final `activate`. Incomplete accounts remain visibly setup-only. | High |
| `Contribute` | **Rewrite.** Multi-transaction proof flow, context cleanup, expected-counter retry, amount-free accepted receipt/hash-chain proof, deadline/refund disclosure and explicit direct-credit rejection. | High |
| `PrivateVault` | Rename visible surface to **Private workspace** while keeping `/private`; implement ADR-010 derivation, capability check, historical-version sweep, fixed-denomination top-ups, correlation warning and wrap/apply/withdraw. | High |
| `Market` | **Rewrite data and transaction layer.** Unequal-decimal Q64.64 quotes, bounded slippage, no fake timestamps, tracked reserves, DAMM position owner/unlock and indexer-backed candles with explicit degradation. | High |
| `Activity`, `Timeline` | **Rewrite the data layer.** Same reason. | High |
| `IdoClaim` | Verify manifest/count/chain head locally; `open_claim` verifies allocation/refund proof before account creation, then `claim` pays canonical ATA and close refunds rent. Distinct emergency-refund copy. | Medium |
| `Holders` | Top accounts via `getTokenLargestAccounts`; full view via mint-filtered token accounts/indexer, aggregated by owner. State the top-20 boundary when degraded. | Medium |
| `FeeBuilder` | Reads fixed splits with monotonic accrued/released fields; enforces duplicates/total, identifies per-delta remainder recipient and makes lock-before-activation explicit. | Medium |
| `ProofVerifier` | Reframed: verifies the CT proof chain and the Merkle proof rather than a circom proof. The proof timer changes shape. | Medium |
| `PrivacyLedger` | **Content rewrite.** Auditor/tally trust, accepted-transfer hash chain, proof-key liveness, public emergency-refund downgrade, authority posture, liquidity lock, verified build and indexer exception. | Medium |

| Component | Change |
|---|---|
| `ChainGuard` | Cluster mismatch instead of chain id. See §15 I-09. |
| `NodeStatus` | RPC health, current slot, commitment level, priority-fee level. Richer than the EVM version. |
| `Earnings` | Protocol-wide lookup by recipient. "Collect all" chunks one `release(recipient)` across owed routers, preserves ordered progress, resumes after rejection/expiry and creates recipient ATAs explicitly. `release_all` remains the per-router operator helper, not the user flow. |
| `Portfolio`, `Leaderboard`, `Compare`, `Feed`, `Boards`, `Profile`, `Promote` | Account-first current state plus indexer-backed history; explicit degraded states. `savedMany`/`followsMany`/`promotedMany` become direct multi-account reads. |
| `Discussion` | Typed `parent_index`, one visual nesting level, deep links, creator/you badges, visible-body character count, author-only withdrawal, no score. |
| `LaunchModels` | Exactly three cards: instant raise, split raise, open a desk. Only the first two are creation forms; the third links to `/desks`. |
| `Prerequisites` | Content change: SOL for rent + fees, a CT-configured token account, `cUSDC` balance. |
| `Toasts`, `toast-context` | Signature-based lifecycle: sent → processed → confirmed → finalized. Must state which commitment it is showing. |
| `ActionButton` | Simulate-before-sign, CU price, blockhash-expiry retry. |
| `Card`, `Logo`, `Shell`, `Skeleton`, `StatusDisplay`, `StyledIntput`, `Shortcuts`, `Tour`, `Preferences`, `PriceAlert`, `ShareCard`, `CommandPalette`, `ErrorBoundary`, `LaunchModels`, `LaunchDetail`, `ui/` | Mechanical or unchanged. `Logo` takes the accent change only. Keep the `StyledIntput` filename typo or fix it in one dedicated commit — not mixed into a port PR. |

### 9.3 Deleted

`src/contracts/bytecode.ts` (no per-launch deploy), `src/EERC.ts` (replaced by
`packages/confidential`), `src/typechain-types/` (replaced by Codama), the proving-key
assets in `public/`. `public/_redirects` stays — the SPA rewrite is still needed.

---

## 10. Design system

Full specification in `DESIGN.md`; drop-in tokens in `tokens.css`. Summary of the change:

**The accent becomes Solana violet, in three measured values, because one value cannot
carry both a filled control and a figure on a near-black ground.**

| Token | Value | Job | Measured on `#08090a` |
|---|---|---|---|
| `--sol` | `#9945FF` | non-text marks only: HUD ticks, meter fill, chain badge, focus ring, toast bar, bloom tint | 4.41:1 — **under AA, never text** |
| `--sol-bright` | `#A970FF` | accent text and figures, live marks, hover | 6.1:1 |
| `--sol-deep` | `#6B23C0` | filled primary control | white on it: 8.0:1 |
| `--sol-wash` | `#150A2B` | accent tint block | — |

**Rejected, with reasons:**

- **Solana green `#14F195`.** Measures 13.3:1, so this is not a contrast problem — it is a
  semantic one. `--gain` is `#3fcf8a`. The brand accent and "price went up" would be the
  same colour on a trading surface, and inverting market convention to protect a palette
  would cost a user money.
- **The purple→green gradient.** Gradient fills are already banned by the existing
  anti-references, and violet-to-mint on near-black is the exact look every AI-generated
  dark crypto UI ships. The wordmark's split was moved *off* cyan/magenta for that reason;
  reintroducing the idea in Solana's own two colours would undo it.
- **`#9945FF` as text.** 4.41:1, under AA. Same call the old document made refusing white
  on Avalanche red at 3.99:1.

**The rule that inverts.** The old document says the foreground on a filled control is
dark ink, not white. On violet the arithmetic flips: dark ground on `#9945FF` is 4.41:1
(fails), warm `--ink` is 3.73:1 (fails), pure white is 4.52:1 (passes, thinly). Rather
than ship a 4.52:1 primary action, the fill drops to `--sol-deep` and white measures
8.0:1. The rule was never "dark foreground" — the rule is *measure it*.

**What this improves.** The old accent shared a hue with `--loss` and the two had to be
distinguished by form rather than colour. After this change **red means exactly one thing:
a position that went down.** The allocation ramp is re-derived around the violet for the
same reason — `--cat-creator: #e84142` would have printed the creator's share in the
colour of a losing position.

**Unchanged, deliberately:** ground, the warm four-step ink ramp, hairlines, square
geometry (2px), the three-step type scale with a hard 12px floor, all surface primitives,
the motion policy, the print override, and every anti-reference. A retheme is a token
edit, and this being the third one to prove that is the reason the constraint exists.

**One new hazard the platform introduces.** `.ticked`, the single-flash on a changed
figure, was tuned for 2-second blocks. With account subscriptions at 400ms slots it will
fire far more often; coalesce to at most one flash per figure per 400ms or a dense table
becomes a strobe.

**One new anti-reference.** Wallet-adapter's stock modal ships rounded corners, its own
purple and a blur backdrop — three bans in one component. Theme it to these tokens or
replace it. Same finding the old document recorded about RainbowKit's stock blue.

Verification is unchanged and non-negotiable: `npx impeccable detect` must return zero on
both the static and the runtime scan.

---

## 11. Tooling and command surface

| Source repo | Solana equivalent |
|---|---|
| `hardhat compile` | `anchor build` |
| `hardhat test` | `anchor test` + `cargo test-sbf` |
| `hardhat zkit make/verifiers`, `postzkit`, `fix-zkit-imports.js`, `publish-circuits.js` | **deleted** (ADR-001) |
| `postinstall` compiling circuits | **deleted.** Clean install stops being a multi-minute circuit build |
| `gen-frontend-abis.js` | `anchor build` + Codama codegen |
| `--network fuji` hardcoded in 18 npm scripts | `--provider.cluster` / `CLUSTER` env, never hardcoded |
| `scripts/constants.ts` | `packages/sdk/src/cluster.ts` |
| `run_all_fuji.sh` | `scripts/run_all_devnet.sh` |
| `run_ido_setup.sh` | `scripts/e2e-local.sh` |
| `converter:*` (9 scripts) | `apps/cli confidential:*` — `keys`, `configure`, `wrap`, `deposit`, `apply`, `transfer`, `balance`, `withdraw`, `unwrap` |
| `standalone:*` (8 scripts) | `apps/cli token:*` — `create`, `mint`, `balance`, `transfer`, `burn`, `auditor` |
| `scripts/ido/01–10` | `apps/cli sale:*` — `create`, `activate`, `fund`, `tally`, `finalize`, `void-tally`, `settle`, `commit-refund`, `refund`, `claim`, `verify`, `open-market`, `close` |
| `hardhat-gas-reporter` | CU logging from `simulateTransaction`, asserted in tests |
| `solidity-coverage` | `cargo llvm-cov` |
| `solhint`, `prettier-plugin-solidity` | `clippy`, `rustfmt` |
| `merkletreejs` | kept for sorted internal nodes; domain-separated double-hash leaf builder replaces the source leaf (§6.3) |
| `@zk-kit/baby-jubjub`, `maci-crypto`, `poseidon-lite` | **deleted** |
| `@avalabs/eerc-sdk` | **deleted**, replaced by `packages/confidential` |

Note for the record: the source repo's `test` script is not defined and exits 1, while the
README reports 103 passing tests run through Hardhat directly. Wire `pnpm test` properly
in the port.

---

## 12. Test plan

Ports all 11 contract-test files and every enumerated browser acceptance case. The
source contract baseline reports 103 passing. Its browser TESTPLAN enumerates **110** cases
(A10+B12+C26+D8+E13+F6+G13+H12+I10) but its run summary says 101; the summary is wrong and
is not inherited. Target is behavior coverage, not a vanity count.

### 12.1 Ported suites

| Source | Target | Notes |
|---|---|---|
| `BondingCurve.test.ts` | `tests/market.ts` | plus `u64`/`u128` boundary cases and the sell-cap attack |
| `Graduation.test.ts` | `tests/graduation.ts` | real DAMM v2 CPI, ALT boundary, atomic rollback and retry; **no direct-transfer fallback** |
| `FeeRouter.test.ts` | `tests/fees.ts` | plus dust accounting and 8-recipient `release_all` CU |
| `LaunchRegistry.test.ts` | `tests/launch.ts` | gPA filters replace paging assertions |
| `BoardsAndComments.test.ts` | `tests/boards.ts`, `tests/social.ts` | |
| `SocialGraph.test.ts` | `tests/social.ts` | |
| `Promotion.test.ts` | `tests/promotion.ts` | lamport transfer replaces `call{value:}` |
| `ido.test.ts` | `tests/claim.ts` | |
| `EndToEnd.test.ts` | `tests/e2e.ts` | instant: setup → activate → trade → locked graduation; raise success and deadline-refund branches, including proof/context cleanup |
| `helpers.ts`, `user.ts` | `tests/helpers.ts` | |

### 12.2 Solana-specific classes the source repo has no equivalent for

1. **Arithmetic boundaries:** `u64/u128` maxima, `ceil_div`, invariant monotonicity,
   unequal-decimal price vectors and 0..5,000 bps slippage validation.
2. **Account substitution:** wrong owner/mint/token program/PDA/bump, arbitrary executable,
   forged mutable Launch destination and every malformed `remaining_accounts` permutation.
3. **Activation barrier:** contribution/trade before activation fail; activation fails for
   unlocked splits, received funds, wrong inventory, unsafe mint/freeze authority, bad
   metadata hash, bad dates, short LP lock and mismatched bindings.
4. **Fixed supply:** mint and freeze authority are `None` before activation; attempted mint,
   freeze or delegate use fails afterward.
5. **Direct-credit gate:** raw confidential and public transfers to Sale vault fail at
   rest; exactly one CPI transfer succeeds during `contribute`; flag remains false after
   every induced failure.
6. **Contribution commitment:** ordinal/count/hash chain matches validated contexts;
   omission, reorder, duplicate, cross-sale and cross-epoch inputs fail manifest checks.
7. **Proof contexts:** wrong proof type/program/keys/auditor/ciphertext/close authority,
   replay and context substitution all fail; every context's rent is recovered.
8. **Pending-counter races:** fill cap, concurrent credit between fetch/apply, stale AES
   ciphertext rejection, refetch/rebuild and keeper recovery.
9. **Settlement binding:** mutable Launch, fake wrapper/router, wrong USDC destination,
   partial unwrap and retry cannot redirect or double count.
10. **Inventory before proceeds:** no Router transfer until all contributed USDC is
    settled and exact project claim inventory is funded.
11. **Emergency refund:** missed deadline, timelocked commitment, seven-day review,
    public-amount disclosure, full refund, duplicate-proof rejection and no creator route.
12. **Wrapper solvency:** unsolicited donation, unsupported underlying extension,
    transfer-delta mismatch, pause-with-unwrap, excess recovery and insolvency attacks.
13. **Router accrual:** property-test random deposits/splits; accrued is monotonic, sum exact,
    releases order-independent and no dust/sweep path exists.
14. **Curve conservation:** reserve product never falls from rounding, virtual base cannot be
    withdrawn, donations do not alter quotes and atom/boundary trades are safe.
15. **Graduation:** real cloned DAMM v2 CPI, ALT/size/CU boundary, atomic rollback/retry,
    Curve-PDA position ownership, fee routing and 180-day release rejection.
16. **Merkle domains:** hardcoded Rust/TypeScript claim/refund vectors; cross-sale,
    cross-mint, cross-kind and single-hash proofs fail at depth 0 and 20.
17. **Rent:** exact payer/refund for ClaimStatus, proof contexts and closable setup accounts.
18. **Clock/state:** start/end/deadline/review boundaries and cluster-time UI behavior.
19. **Resumable setup:** fail/reload after each transaction; no duplicate paid step; only
    dependency descendants invalidate; incomplete launch never accepts value.
20. **Indexer rebuild/forks:** empty DB convergence, duplicate/reordered delivery,
    finalization rollback, no block/slot-as-Unix fallback and provider degradation.
21. **Metadata:** MIME/size/hash/URI, no data URI, immutable bytes after activation unless
    governed version event updates URI+hash.
22. **Auditor/key operations:** valid-point/canonical key checks, old/new epochs, 2-of-3
    normal ceremony and funded 3-of-5 disaster-recovery refund drill.
23. **Authority handover:** verified programs immutable, mint/freeze/close delegates absent,
    exact Squads/timelock owners and pause cannot block exits.
24. **Parity/UI:** all 110 browser cases, 19 route entries and 41 components; no stale PASS
    labels, secrets, mocks or fabricated figures.

### 12.3 SDK parity

Property tests over random reserves asserting `packages/sdk/math.ts` and the on-chain quote
agree exactly. A client that computes price differently from the program is how a slippage
guard silently disagrees with the trade it is guarding.

### 12.4 Design verification

`npx impeccable detect apps/web/src` and `npx impeccable detect http://localhost:5173`,
both zero, in CI. Plus the manual check in `DESIGN.md`: on a live curve page, no violet
element adjacent to a gain/loss figure in a way that could be misread as direction.

### 12.5 Browser acceptance parity

Port the source's 110 enumerated cases, preserving observable behavior and applying only
these chain substitutions:

| Source group | Count | Solana rule |
|---|---:|---|
| Shell/navigation | 10 | slot/commitment replaces block number; cluster genesis hash replaces chain ID |
| Feed | 12 | current state from accounts, ranked/history fields from indexer |
| Launch detail | 26 | custom curve remains; CT raise never fabricates market data |
| Discussion | 8 | typed parent field replaces the body marker; all visible behavior stays |
| Create flow | 13 | resumable 3-5 transaction plan replaces exactly four EVM deployments; result semantics stay |
| Desks | 6 | slug PDA and allowlist account semantics |
| Earnings/activity/profile/settings | 13 | collect-all remains ordered per-router writes; indexer history can degrade |
| Private workspace | 12 | stable re-derivation, not secret persistence; Token-2022 replaces registration contract |
| Cross-cutting | 10 | no console/RPC errors, no mocks, wrong-cluster browser test is mandatory |

The source marked wrong-network handling untested. The port must run it using two local
validators with distinct genesis hashes. No source PASS status is copied forward; every
case is executed again.

## 13. Deployment and verification

### 13.1 Localnet parity

Confidential transfers are feature-gated. `solana-test-validator` defaults will
happily pass tests that then fail on devnet, which is the worst possible failure
shape: green locally, red in front of users. Therefore:

- Pin the validator version in `scripts/localnet.sh` and **print it** on every run.
- Assert at test-suite setup that the ZK ElGamal Proof Program is present and
  enabled. Fail loudly with a named error, not a confusing proof-verification
  failure 40 lines deeper.
- **Clone Meteora DAMM v2 and required accounts into the validator** from mainnet rather than mocking it.
  A mock reproduces neither the account layout nor the CU cost, and graduation is
  exactly where a wrong CU estimate is unrecoverable.

### 13.2 Progression

| Stage | Starts at | Gate to leave |
| --- | --- | --- |
| Localnet | every phase | phase acceptance criteria in §14 |
| Devnet | from P0 onward | full confidential cycle observed end to end |
| Mainnet | only after P6 | ADR-005 satisfied and §13.4 complete |

No exceptions on the last row. A launchpad that holds contributor funds does not
get a soft launch.

### 13.3 Verified builds

`solana-verify build` and `solana-verify verify-from-repo` in CI on every tagged
release. Surface the resulting status inside `PrivacyLedger` so the claim is
visible where the trust claim is made.

This is a **stronger** guarantee than the Etherscan source verification the source
repo relies on: it attests the deployed bytes match the named commit, not that
some source compiles to something similar.

### 13.4 Release and authority handover checklist

All required before uncapped mainnet:

1. Revoke upgrade authority on `norr_claim`, `norr_fees`, `norr_market`, `norr_wrap`; attach
   `solana program show` output and verified-build hashes.
2. Put launch/boards/social and all allowed config powers under named 3-of-5 Squads plus
   72-hour timelock; document each executable permission.
3. Prove project mint authority, freeze authority, permanent delegate and close authority
   are absent before every activation.
4. Verify Sale vault owner is Sale PDA, both credit flags are false at rest, stored
   wrapper/USDC/Router destinations match and raw direct credits fail.
5. Lock every Router before activation and verify no pre-lock receipts. Publish split and
   per-delta remainder recipient.
6. Verify DAMM IDs/config, Curve-PDA position authority, beneficiary and >=180-day unlock.
7. Complete a funded success settlement **and** deadline-refund disaster-recovery drill with
   different operators; reconcile every atomic unit and rent refund.
8. Generate per-cluster manifest; verify genesis hash, account owners, executable IDs, IDL
   hashes, mint extensions/authorities, auditor epochs and external authority posture.
9. Run secret scanning over repository/history/build artifacts. Allow only named public
   local-validator keys; rotate anything ever used outside local fixtures.
10. Resolve and record source/dependency licensing: the pinned repo has no root LICENSE,
    `package.json` says ISC, contracts mix MIT and Ava Labs “Ecosystem” notices. Preserve
    notices and obtain permission or clean-room replace before copying restricted code.
11. Update `PrivacyLedger`, threat model and release notes to the exact trust/refund/privacy
    posture that passed—not the intended one.

---

## 14. Phase plan

### P0 — Confidential transfer and custody spike (7-10 days) **BLOCKING**

Nothing that assumes private mainnet starts until all pass on the target feature set:

- configure/deposit/apply/transfer/withdraw and ConfidentialMintBurn end to end;
- mint-level auditor, valid-point rejection and `UpdateMint` historical epochs;
- context-state owner/type/key/ciphertext/auditor binding and rent cleanup;
- expected/actual pending-counter race plus measured saturation/recovery threshold;
- Sale-PDA-owned account with both credits disabled at rest and atomic one-transfer gate;
- accepted contribution count/hash-chain vector reproduced by Rust and TypeScript;
- custom wrapper strict extension allowlist, donation surplus and 1:1 liability tests;
- 2-of-3 normal key ceremony and 3-of-5 funded disaster-recovery refund drill;
- deterministic wallet key recovery across named browser/mobile/hardware wallets;
- transaction count, 1,232-byte size, CU, latency, rent and priority fee per step;
- public wrap/refund correlation disclosure reviewed in the actual UI copy.

Failure blocks private mainnet. No custom private ledger or operator-owned vault fallback.

### P1 — Public core and activation barrier (3.5-4.5 weeks)
`norr_launch`, `norr_boards`, `norr_fees`. No privacy surface. Fully testable.

### P2 — Sealed layer and emergency refund (5-7 weeks)
`norr_wrap`, `norr_claim`, accepted-transfer commitment, keeper, tally, success settlement and the complete public-refund branch. Highest risk after P0.

### P3 — Market (3-4 weeks)
`norr_market`, ceiling-rounded source curve, locked-position DAMM v2 graduation and fee collection.

### P4 — Desks and social (2-2.5 weeks)
`norr_social`, promotion, comments.

### P5 — React frontend + indexer (5-6 weeks, starts during P2)
All 19 route entries, all 41 components, the retheme commit.

### P6 — Hardening (4-5 weeks)
Audit prep, §13.4, verified builds, fuzzing the curve, DAMM v2 integration, manifest/rebuild drills.

### Revised totals

| Scope | Solo | Team of 3 |
| --- | --- | --- |
| Full parity | **21-28 weeks** | **12-17 weeks** |
| MVP (P0-P3 + minimal UI) | **14-20 weeks** | **8-12 weeks** |

This supersedes the ~12-16 week figure given in the original chat response. That
number did not scope `norr_wrap`, the pending-balance keeper (§7.4), the activation
barrier, accepted-transfer commitment, refund path, locked DAMM position or indexer. It was
wrong, and this says so on the record.

---

## 15. Solana-specific registers

### 15.1 Issues — genuinely harder or newly risky

Every row is either removed by architecture, has a named implementation/test gate, or is
explicit residual risk. “Resolved” means the design no longer contains the vulnerable
path; it does not replace implementation review.

| # | Issue | Severity | Final mitigation |
|---|---|---|---|
| **I-01** | `u64`/`u128` overflow and reserve math | Critical | §6.1 checked bounds/ceil division; property and boundary tests |
| **I-02** | Upgradeability defeats locks/custody | Critical | ADR-005 authority revocation and verified builds |
| **I-03** | Account/proof-context rent | High | named payer/refund, proof cleanup and rent tests |
| **I-04** | CT proofs exceed one transaction | High | §7.3 context accounts, resumable plans, size/CU assertions |
| **I-05** | Pending-credit saturation stops contributions | High | §7.4 measured low-water keeper and race recovery |
| **I-06** | Public wrap/escrow correlates confidential contribution | High product | no same-amount autofill; denomination/time warnings; V2.3 pooled adapter |
| **I-07** | No historical log-range API | High | rebuildable indexer, two providers, finalized checkpoints |
| **I-08** | Heavy `getProgramAccounts` scans | Medium | stable offsets (creator 8, board 40, fixed prefix 274), `dataSlice`, indexer |
| **I-09** | Wallets lack EVM wrong-network state | Medium | RPC genesis hash plus account-owner validation |
| **I-10** | `Clock`/wall-clock drift | Medium | state+cluster time, tolerant boundaries, no false precision |
| **I-11** | Uneven Token-2022 venue/wallet support | Medium | CT only for cUSDC; legacy SPL project/USDC venue path |
| **I-12** | Fast-slot sniping | Medium | first-slot cap plus optional V2 encrypted order flow |
| **I-13** | Priority-fee spikes | Medium | simulation and dynamic bounded fee policy |
| **I-14** | Commitment/fork semantics | Medium | confirmed UX, finalized money/index checkpoints |
| **I-15** | Variable strings cost rent | Low | byte caps and Irys metadata |
| **I-16** | Localnet/mainnet feature drift | High | target feature assertion and cloned DAMM integration |
| **I-17** | Merkle proof near 1,232 bytes | Medium | depth 20 cap and serialized boundary test |
| **I-18** | Duplicate split recipient ambiguity | Low | reject and canonicalize before lock |
| **I-19** | Auditor rotation is non-retroactive | Medium | epoch/slot history and retained offline shares |
| **I-20** | Confidential mint reaches public fees/market | Resolved critical | invariant 11; stored cUSDC->USDC boundary in Sale |
| **I-21** | Wallet-derived key loss | Residual | deterministic versioned recovery, bounded workspace; auditor cannot spend |
| **I-22** | DAMM CPI transaction size/CU | High | cloned DAMM v2, versioned tx/ALT, exact benchmark |
| **I-23** | Abandoned proof contexts leak rent | High | close authority validation, discovery/cleanup, induced failures |
| **I-24** | Bare/single-hashed leaf permits domain mistakes and fragile node-as-leaf reasoning | High | §6.3 domain-separated double-hash claim/refund leaves |
| **I-25** | Unclaimed-allocation sweep confiscates valid claims | Resolved | no expiry/sweep; close only after all liabilities claimed |
| **I-26** | Official Token Wrap has immutable no-auditor config | High | audited custom wrapper; never claim official deployment is used |
| **I-27** | “One transaction” launch promise deletes recovery and may not fit | High | measured resumable 3-5 transaction setup |
| **I-28** | 12 kB inline logo cannot fit account URI | High | Irys immutable bytes + stored metadata hash |
| **I-29** | Deleted deployment manifests recreate hardcoded addresses | High | generated, validated per-cluster manifests |
| **I-30** | Source TESTPLAN says 101 but enumerates 110 | Medium | port/run all 110; no inherited PASS labels |
| **I-31** | Source functional spec trails shipped code | Medium | code/tests/UI precedence and parity delta doc |
| **I-32** | CT hides amounts, not identity/timing/graph | High product | precise amount-confidentiality copy and leak model |
| **I-33** | Upgradeable/substitutable DAMM accounts | High | pinned executable/config/owner/mints plus disclosed upstream authority |
| **I-34** | Source AMM failure sends reserves to arbitrary recipient | Resolved critical | no fallback; atomic rollback/retry |
| **I-35** | “No EVM reentrancy” hides CPI/stale-account risk | High | IDs/constraints, checks-effects-interactions, reload, adversarial CPI tests |
| **I-36** | `getTokenLargestAccounts` is only top 20 token accounts | Medium | full indexed enumeration and owner aggregation; label fallback |
| **I-37** | ~400 ms slot called finality | Medium product | processed/confirmed/finalized shown separately |
| **I-38** | Operator-owned CT vault bypasses immutable claim program | Resolved critical | Sale-PDA ownership and constrained signing |
| **I-39** | Anyone can send directly to a known Sale token account, bypassing window/receipt | Critical | both credits off at rest; atomic enable-transfer-disable gate |
| **I-40** | Sale lacked committed raised total and immutable wrapper/USDC/Router destination | Critical | expanded 534-byte Sale stores totals and all settlement bindings |
| **I-41** | Users could enter before splits, inventory and mint authority were final | Critical | ADR-012 inert setup plus one-way activation |
| **I-42** | Plan referenced refunds but specified no v1 instruction/state/runbook | Critical liveness | ADR-009 deadline, timelocked refund root, public refund claims and DR drill |
| **I-43** | Unsolicited SPL donations make `vault == supply/liability` impossible | High | internal liability ledger, `>=` solvency, bounded immutable excess recovery |
| **I-44** | Cumulative rounding-dust sweep can make an entitlement move backward | High | per-new-delta accrued accounting; exact batch remainder; no sweep |
| **I-45** | Project mint/freeze authority could inflate or freeze after users enter | Critical | fixed supply and all dangerous authorities `None` before activation |
| **I-46** | Floor reserve division was mislabeled pool-favoring; decimal conversion omitted | High | ceil reserve division and explicit 9/6 Q64.64 conversion |
| **I-47** | Creator-controlled DAMM position enables immediate liquidity removal | High | Curve-PDA position and >=180-day published lock |
| **I-48** | Valid proof context can be substituted across sale/mint/type/ciphertext | Critical | bind owner/type/keys/handles/ciphertext/close authority and consume once |
| **I-49** | Invalid/off-curve key or stale pending counter can brick/corrupt CT operation | High | canonical SDK validation plus expected/actual counter refetch/rebuild |
| **I-50** | Transaction references alone let a tally omit/reorder accepted contributions | High | on-chain count and rolling validated-context hash chain |
| **I-51** | Source commits a hardcoded vault decryption private key and stores browser keys | Critical ops | never copy; history/build secret scan, rotate nonlocal use, memory-only derivation |
| **I-52** | No root LICENSE; package says ISC while files mix MIT and Ava Labs notices | Release blocker | provenance inventory, preserve notices, permission or clean-room replacement |

### 15.2 Improvements — what gets better, and what deletes

| # | Improvement | Impact |
|---|---|---|
| **IMP-01** | No browser bytecode deployment | Resumable PDA setup; executable bytes never ship to React |
| **IMP-02** | Reusable programs | No per-launch program deployment cost |
| **IMP-03** | Slug PDA uniqueness | Deletes registry/sentinel/race machinery |
| **IMP-04** | Account discovery | gPA/indexer replace EVM paging arrays |
| **IMP-05** | CPI-specific safety | Deletes Solidity guard but adds real account/callee/reload tests |
| **IMP-06** | Direct vault reads with internal liabilities | Reconciliation is explicit and donation-safe |
| **IMP-07** | No allowance round trip | Program CPIs transfer directly to constrained vaults |
| **IMP-08** | V2 compressed social state | Major rent reduction after proof/export gates |
| **IMP-09** | Signed on-chain social at low transaction cost | Keeps source authorship model |
| **IMP-10** | Standard CT audit handles | Deletes source Go/TypeScript decryptor scripts |
| **IMP-11** | Protocol CT replaces custom balance circuits | Deletes circom/zkit/verifier/proving-key pipeline |
| **IMP-12** | Simulation-first transactions | Exact CU/errors before signature |
| **IMP-13** | Account subscriptions | Replaces 2-second polling |
| **IMP-14** | Fast feedback with honest commitment labels | No fake sub-second finality |
| **IMP-15** | Maintained post-graduation venue | DAMM v2 with locked position and routed LP fees |
| **IMP-16** | Verified builds | Byte-for-byte release evidence |
| **IMP-17** | Explicit rent lifecycle | Payers and refunds are testable |
| **IMP-18** | Minimal extension allowlist | CT features without permanent delegate/hooks/fee/freeze surprises |
| **IMP-19** | Blinks/Actions | Shareable executable launch links after activation |
| **IMP-20** | Auditable holder data | Full owner aggregation; top-20 fallback labelled |
| **IMP-21** | Solana violet leaves red to loss | Clear market semantics |
| **IMP-22** | Marker PDAs batch-read directly | Deletes social batch-view instructions |
| **IMP-23** | Claims do not expire | No confiscatory sweep |
| **IMP-24** | One-way activation barrier | Setup failure cannot expose mutable economics to users |
| **IMP-25** | Accepted-transfer hash chain | Complete, ordered tally input is committed on chain without amounts |
| **IMP-26** | Bounded emergency refund | Converts indefinite operator liveness failure into a disclosed exit |
| **IMP-27** | Monotonic per-delta fee accrual | Exact allocation with no dust sweep or backward entitlement |
| **IMP-28** | Domain-separated double-hash leaves | Claim/refund proofs cannot cross sale, mint or kind |
| **IMP-29** | Curve-owned liquidity position | Removes immediate post-graduation withdrawal/rug path |
| **IMP-30** | Secret/license release gates | Prevents copying the source's key and ambiguous notices into production |

---

## 16. Parity checklist

### 16.1 Contracts

| Source | Destination |
| --- | --- |
| `IDO.sol` | `norr_claim` |
| `FeeRouter.sol` | `norr_fees` |
| `BondingCurve.sol` | Rust/Anchor `norr_market`; exact integer behavior/property vectors |
| `LaunchRegistry.sol` | `norr_launch` |
| `BoardRegistry.sol` | `norr_boards` |
| `SocialGraph.sol` | `norr_social` |
| `LaunchComments.sol` | `norr_social` |
| `Promotion.sol` | `norr_social` |
| `ProjectToken.sol` | fixed-supply 9-decimal legacy SPL mint; mint/freeze authorities revoked before activation |
| `EncryptedERC.sol` | Token-2022 CT + generic-per-underlying `norr_wrap`; 1:1, same decimals, no dust |
| `EncryptedUserBalances.sol` | CT extension internals |
| `Registrar.sol` | `ConfigureAccount` |
| `NewRegistrationVerifier.sol` | ZK ElGamal Proof Program |
| `contracts/verifiers/*` | deleted (ADR-001) |
| `LiquidityPair.sol` | not ported; Meteora DAMM v2 (ADR-004), 0.30% fee target |
| `PairFactory.sol` | not ported; canonical migrated pool stored per launch, venue may support multiple pair configs |
| `contracts/auditor/*` | mint-level auditor key |
| `contracts/errors/*` | Anchor `#[error_code]` |
| `contracts/interfaces/*` | Anchor IDL |
| `contracts/libraries/*` | `programs/*/src/math.rs` |
| `contracts/tokens/*` | strict SPL/Token-2022 mint validation and wrapper allowlist; unbounded tracker arrays do not port |
| `contracts/types/*` | Anchor account structs |
| (new) | `norr_wrap` — ADR-002 |

### 16.2 Scripts

All three suites port by behavior. `scripts/ido/*` becomes `apps/cli`; converter and
standalone flows collapse into `packages/confidential`. Generated verifier/build helpers
delete; Codama generates clients. Fix the doubled `01_deploy_ido.ts.ts` name. Never copy
`scripts/ido/10_hardcoded_decryptor.ts`: it contains a literal vault private key and is
covered by I-51. Claim proof artifacts become canonical tally outputs, not source files.

### 16.3 Tests, docs, frontend

103 passing tests must have counterparts. `test/*.test.ts` maps to `tests/` with
LiteSVM for unit work and `solana-test-validator` for integration. **Wire `pnpm test`
properly** — in the source repo the `test` script is undefined and exits 1.

Docs port with amendments per ADR. The stale functional spec is reconciled against code/current UI/tests (I-31). All **19 route entries** (18 addressable + fallback) and all 41 components are accounted for in §9.

### 16.4 Transformed or not ported, with reasons

| Item | Reason |
| --- | --- |
| `circom/`, `zk/` | ADR-001 — protocol replaces circuits |
| `LiquidityPair`, `PairFactory` | ADR-004 — DAMM v2 locked position instead |
| `bytecode.ts` | IMP-01 — nothing to deploy client-side |
| `hardhat.config.ts` | Anchor.toml |
| `typechain-types/` | Codama + Anchor IDL |
| eERC proving assets | deleted with custom circuit ledger; claim `proofs-*.json` becomes content-addressed tally manifests/proofs |
| `deployments/*-31337.json` | **transformed**, not deleted: generated `deployments/{localnet,devnet,mainnet}.json` consumed by web/CLI |
| `ReentrancyGuard` | IMP-05 |
| `public/_redirects` | **kept** — SPA rewrite still needed |

---

## 17. Final decisions — Q1-Q8 resolved

No architecture choice in this register remains open. Implementation spikes validate the
choices; they do not reopen them silently.

### Q1 — Confidential transfers or fallback?

**Use Token-2022 Confidential Transfers.** It is the official balance primitive and removes
our custom cryptographic ledger. P0 must pass on the target cluster. Failure blocks private
mainnet; it does not trigger an improvised Groth16 balance system. ADR-001.

### Q2 — Build the curve or adopt Meteora DBC?

**Build the source curve in Rust/Anchor; do not use DBC.** Exact curve math, virtual-reserve
sell cap and eight-way fee economics are core parity. Graduate into **Meteora DAMM v2** so
post-graduation liquidity uses maintained infrastructure. ADR-004.

### Q3 — Who audits, and can the key rotate?

**A 2-of-3 independent council holds normal offline auditor/proof shares; the vault key
is separate. A distinct encrypted 3-of-5 disaster-recovery set exists only for the
post-deadline refund runbook. The timelocked config authority rotates the public auditor
key with Token-2022 `UpdateMint`.** Retain old epochs; no browser/indexer holds a secret.

### Q4 — Verifiable tally or trusted operator?

**For v1, use a threshold-attested tally and disclose that correctness/liveness are
threshold-trusted while custody is program-constrained.** Sale PDA owns funds; count and
rolling hash commit every accepted contribution; two operators reproduce the manifest;
24-hour review can void a bad root; the deadline refund is a separate 3-of-5 path. Arcium
remains V2 after same-amount and independent-refund gates. ADR-009/011.

### Q5 — Immutable or governed?

**Hybrid by risk.** Claim, fees, market and wrapper become immutable before uncapped value.
Launch, boards and social remain upgradeable behind 3-of-5 Squads + 72-hour timelock.
Narrow config/pause authority cannot redirect funds. ADR-005.

### Q6 — Which indexer?

**Self-owned TypeScript indexer + PostgreSQL; Helius LaserStream primary, Triton RPC
fallback.** Account state remains direct-from-chain; the indexer handles history/search and
is disposable/rebuildable. This accepts a backend but not a trusted backend. ADR-006.

### Q7 — Which accent?

**Solana violet.** `#9945FF` for non-text marks, `#A970FF` for text, `#6B23C0` under white
filled-control text. No gradient, no Solana green, and red is reserved for loss. ADR-008 and
`DESIGN.md`.

### Q8 — Where is the unwrap boundary?

**Dedicated `norr_claim::settle` after success tally review and before claims open.** It
is incremental/idempotent, uses immutable stored destinations and routes proceeds only
after full unwrap plus claim funding. If it never starts by the fixed deadline, the
separate timelocked `commit_refund`/`settle_refund` branch opens public USDC refunds.
Neither `finalize` nor market `graduate` owns the unwrap. ADR-009.

---

## 18. Privacy landscape (August 2026; research context)

This section records the research that informed the final choices. **§17 and the ADRs win
where they differ from exploratory language here.** Keeping the discarded branches makes
the reasoning auditable; it does not leave them open.

### 18.1 The four levels

Solana's own framing is a spectrum, not a switch: pseudonymity (default),
anonymity (ZK), confidentiality (the CT extension), full privacy (MPC / FHE).
ADR-001 treated this as a binary choice between the CT extension and hand-rolled
circuits. That framing was too narrow.

| Layer | Technology | Status Aug 2026 | Relevance here |
| --- | --- | --- | --- |
| Confidentiality | Token-2022 Confidential Balances | Live, all clusters | Contribution balances — already chosen |
| Full privacy | **Arcium** MPC (Arcis DSL, CPI-invoked MXEs) | Mainnet alpha; ~4M txs; 12+ apps | The sealed **tally** — see §18.2 |
| Anonymity / state | **Light Protocol** ZK Compression — **acquired by Helius, June 2026** | ~90M compressed accounts | Social layer cost — IMP-08 |
| Anonymity | Custom Groth16 via `alt_bn128` syscalls | Live on mainnet-beta since 1.18 | isolated-proof option — viable, not selected for balances |
| Full privacy | TEE coprocessors (Encifher, Jito BAM, Sonic North Star) | Research to early production | Anti-snipe — I-12 |
| Execution | Darklake encrypted orderflow (acquired by SOL Strategies, Jul 2026) | Live | Anti-snipe — I-12 |

Historical note worth internalising: **every first-generation Solana privacy
protocol died.** Elusiv sunset March 2024. Light pivoted off shielded UTXOs to
compression. Otter Cash before both. This is the argument for building on a
protocol-level primitive (the CT extension) rather than a third-party network,
and it is why ADR-001's original instinct was right even though its framing was
too narrow.

### 18.2 MPC tally — promising, not the v1 dependency

Arcium demonstrates the right end-state: encrypted bids, on-chain collateral, private
computation, verified output and permissionless settlement. It is materially better than a
single operator when integrated end to end.

It is not enough to point at a sealed-auction demo. This product uses Token-2022 CT for the
money leg. A production design must prove that the amount supplied to MPC is the same
amount transferred through CT, verify the callback deterministically, survive network
liveness failure and refund without Arcium cooperation. The announced Confidential
Transfer Adapter may solve the binding/ownership gap, but announced code is not a mainnet
primitive.

Final choice: ADR-011/Q4 ships a transparent 2-of-3 threshold-attested tally in v1 and
keeps Arcium as a gated v2. This reverses the earlier exploratory recommendation without
discarding the research.

### 18.3 Register revisions after verification

**I-06 — remains High.** ConfidentialMintBurn encrypts the token-side mint/burn amount,
but wrapping still moves the underlying SPL token publicly and leaves a publicly readable
escrow balance. Those values can be correlated with a later CT contribution. The earlier claim that mint/burn alone fixed the
oracle was wrong. ADR-010 supplies mitigations; a pooled/program-owned confidential adapter
is the eventual structural fix.

**I-12 — additional mitigations.** Jito BAM confidential block building and encrypted
orderflow can complement the first-slot cap. They do not replace deterministic on-chain
limits.

**I-19 / Q3 — answered.** Token-2022 `UpdateMint` can set, rotate or clear the auditor.
Rotation applies only to future transfers, so old epoch keys remain necessary for history.
Q3 chooses offline 2-of-3 custody plus published epoch boundaries.

**IMP-08 — stronger footing.** Light Protocol is now owned by Helius. ZK Compression
remains the preferred v2 route for social-state cost, but ordinary accounts ship first.

### 18.4 Final interpretation of the alternatives

- **Token-2022 CT** wins for balances (Q1).
- **Custom Groth16** is technically viable at roughly 78k-109k CU for isolated proof
  verification, but not selected as a second balance ledger.
- **Arcium MPC** is attractive for a later tally/program-owned balance adapter, but only
  after the CT-to-MPC amount-binding and refund gates in ADR-011.
- **Official SPL Token Wrap** is not used because its default CT mint is immutable and has
  no auditor; that conflicts with Q3. `norr_wrap` reuses the design, not the deployment.
- **ConfidentialMintBurn** is enabled, but it hides neither the public underlying transfer nor aggregate escrow backing.
- **BAM / encrypted orderflow** are additive anti-MEV layers, never correctness assumptions.

### 18.5 Closed research actions and implementation gates

| # | Result / required gate | Phase |
|---|---|---|
| **A-01** | P0 proves CT, ConfidentialMintBurn and auditor epochs on target cluster | P0 |
| **A-02** | **Closed:** official Token Wrap has no auditor; use ADR-002 | Decision |
| **A-03** | Track Arcium; no v1 dependency | V2 |
| **A-04** | MPC must prove same-amount CT binding and independent refund | V2 |
| **A-05** | Rewrite PrivacyLedger to exact trust/leak/refund model | P5 |
| **A-06** | Keep wrapper SDK boundary replaceable without changing existing Sales | P2 |
| **A-07** | Groth16 is isolated research, never balance fallback | Research |
| **A-08** | Measure locked-position graduation against cloned DAMM v2 and ALT | P3 |
| **A-09** | Verify deterministic keys on named browser/mobile/hardware wallets | P0 |
| **A-10** | **Closed:** settle plus refund state machine ratified | Decision |
| **A-11** | Prove direct credits fail and atomic contribute gate closes on every failure | P0/P2 |
| **A-12** | Complete funded 2-of-3 normal and 3-of-5 disaster-refund ceremonies | P0/P6 |
| **A-13** | Secret-scan repository/history/artifacts; rotate every nonlocal exposed key | P6 |
| **A-14** | Resolve mixed/missing source licenses before copying code/notices | Before implementation |
| **A-15** | Property-test ceil curve, 9/6 price and per-delta split accrual | P1/P3 |
| **A-16** | Verify mint/freeze authority revocation and 180-day position lock at activation | P1/P3 |

### 18.6 Provenance

Sources: solana.com/privacy; solana-program.com Token-2022 project status and
Confidential Balances / mint-burn docs; arcium.com (Confidential SPL Token,
ecosystem, mainnet); helius.dev (Light acquisition, Helius Privacy);
github.com/Lightprotocol/groth16-solana (CU benchmarks); solana.com/upgrades
(SIMD-0302, SIMD-0388); iacr.org (Encifher, TEE coprocessor).

Two pages encountered during this research (Inco's SVM documentation and a
Chainstack ZK guide) carried obfuscated prompt-injection text in their
documentation index. Their instructions were ignored; only facts corroborated by
independent sources were used. Worth knowing if this research is repeated by an
agent.

---

## 19. V2 roadmap — future scope, not v1

Nothing in this section is required for the v1 launch defined by §14. V2 work starts only
after v1 completes an external audit, ships on mainnet, operates through at least two full
raise/settlement cycles, and closes its post-launch incident review. Research may happen in
parallel; production dependencies may not leak backward into v1.

### 19.1 V2 rules

1. **V1 stays immutable.** `norr_claim`, `norr_fees`, `norr_market` and `norr_wrap` are not
   upgraded to become v2. New behavior ships under new program IDs for new launches.
2. **No forced migration.** Existing launches, vaults, claims and fee entitlements remain
   on their original programs until naturally complete. Never move a live confidential
   vault through an admin migration.
3. **Opt-in by launch.** The generated deployment manifest lists supported protocol
   versions. A new `Launch` points to one coherent version set; mixing claim v1 with wrap
   v2 is rejected unless that combination has an explicit compatibility fixture.
4. **Every privacy claim gets a leak model.** Document what remains visible: payer,
   participant accounts, timing, transaction graph, public wrapper backing, auditor access,
   proof operator access and indexer metadata.
5. **No experimental custody.** MPC, TEE, FHE, encrypted mempools and relayers may improve
   privacy or liveness, but none may gain an unconstrained path to contributor funds.
6. **Every new dependency has an exit.** Pin program IDs and versions, provide a direct
   on-chain fallback where possible, and define what users can still do during an outage.

### 19.2 Ordered roadmap

| Release | Workstream | What it adds | Earliest ship gate | Rough effort* |
|---|---|---|---|---:|
| **V2.0** | Version foundation | Versioned deployment manifests, SDK dispatch, compatibility fixtures, dual-read indexer and migration dashboard | V1 schemas frozen and two production cycles indexed | 2-3 weeks |
| **V2.1** | Operator-blind tally | Arcium MXE/adapter or equivalent computes allocations without exposing plaintext to the tally operators | All gates in §19.3.1 plus independent audit | 6-10 weeks |
| **V2.2** | Private eligibility | Groth16 membership/cap proofs, nullifiers and optional relayed fee payment so allowlists need not be published | Circuit audit, replay/correlation tests, hardware-wallet UX | 4-6 weeks |
| **V2.3** | Wrap unlinkability | Pooled or adapter-backed deposits, randomized/fixed denominations and delayed private transfer to reduce public wrap correlation | Solvency proof, permissionless exit, no operator custody | 4-8 weeks |
| **V2.4** | Private transaction delivery | Optional Jito BAM/Darklake-style encrypted order flow for curve trades and anti-sniping | Direct RPC path remains valid; outage cannot strand funds | 3-5 weeks |
| **V2.5** | Social scaling | Light Protocol/ZK Compression for comments, follows and saves; indexer reads compressed and ordinary state | Cost win >=10x, proof availability and export path demonstrated | 3-5 weeks |
| **V2.6** | Optional payout privacy | One-time/stealth recipient addresses for claims and fee withdrawals | Recovery, compliance disclosure and address-substitution threat model | 3-5 weeks |
| **V2.7** | Operator decentralization | Replace the fixed 2-of-3 tally/auditor operation with a larger bonded or threshold network | Slashing/liveness design audited; emergency exit works without quorum | Research |

\*Engineering estimates exclude external audits, dependency wait time and mainnet
observation windows. Tracks do not all have to ship, and release numbers express priority,
not a promise.

### 19.3 Hard gates by privacy track

#### 19.3.1 Arcium / MPC tally

V2.1 is allowed only when one end-to-end fixture proves all of the following on the exact
target cluster and deployed program IDs:

- a cryptographic same-amount binding between the Token-2022 CT transfer and MPC input;
- the Sale PDA remains the only token-account authority;
- callback origin, sale, mint, computation ID and output schema are constrained on chain;
- deterministic allocation/root output matches the v1 integer reference implementation;
- replay, omission, duplicate-input and cross-sale substitution attacks fail;
- a user refund/exit path does not depend on Arcium liveness;
- timeout and retry cannot finalize two different roots;
- transaction size, CU, latency and cost are measured at 10, 100, 1,000 and 10,000
  contributors;
- an independent audit covers both the MXE and Solana adapter.

Until every line passes, ADR-011 remains the production tally.

#### 19.3.2 Groth16 eligibility and caps

Use Groth16 only for a narrow statement such as “member of this allowlist,” “jurisdiction
credential valid,” or “lifetime contribution remains under this cap.” The circuit must
bind cluster, program, sale, wallet/credential commitment and a sale-scoped nullifier.
Publish circuit source, proving artifacts, trusted-setup provenance if applicable, verifier
test vectors and measured CU. A proof must not silently create anonymity claims when the
transaction fee payer still identifies the participant.

#### 19.3.3 Encrypted order flow

Encrypted delivery is an optional transport, never a state transition rule. Slippage,
first-slot caps, mint checks, fee checks and graduation conditions remain enforced by
`norr_market`. The React client always offers a normal transaction path and clearly states
when private delivery is unavailable.

#### 19.3.4 Compressed social state

Compression must preserve author signatures, subject/index ordering, typed reply parents,
author-only withdrawal and deterministic export. If the compression/indexing service is
down, existing content remains recoverable from proofs and the UI states the degradation.
No money-moving account is migrated as part of this track.

### 19.4 Version and migration architecture

V2 deploys alongside v1:

- `norr_claim_v2`, `norr_wrap_v2` and any new adapter receive new immutable program IDs;
- the governed `norr_launch` registry allowlists complete, audited version bundles for
  **new** launches only;
- each deployment manifest records bundle version, program IDs, IDL hashes, verified-build
  commits, external dependency IDs and auditor/key epochs;
- SDK readers dispatch by actual account owner/discriminator, never by a user-supplied
  version label;
- the indexer dual-reads v1 and v2 into one normalized API while retaining raw versioned
  events;
- the React UI displays the launch's protocol/privacy version and its exact trust model;
- v1 claim links, proofs and fee withdrawals remain supported indefinitely;
- migration tooling may copy public metadata or user preferences, never balances,
  allocations, locked splits or live vault authority.

### 19.5 Priority recommendation

Build V2 in this order:

1. **V2.0 version foundation** — prevents every later feature from becoming a dangerous
   in-place upgrade.
2. **V2.1 operator-blind tally** — removes the largest remaining privacy/trust weakness.
3. **V2.3 wrap unlinkability** — addresses the strongest practical inference leak.
4. **V2.2 private eligibility** — useful for regulated or community launches, but not
   required by every raise.
5. **V2.4 encrypted order flow** — improves post-launch execution privacy and MEV posture.
6. **V2.5 compressed social state** — scale/cost improvement, not core privacy.
7. **V2.6 stealth payouts** and **V2.7 operator decentralization** — valuable only after
   recovery, compliance and liveness designs are proven.

### 19.6 Explicitly out of scope until separately approved

- a new L1, sidechain or custom rollup;
- a protocol-native privacy coin;
- replacing Token-2022 CT with a second private balance ledger;
- TEE-only or FHE-only custody of contributor funds;
- cross-chain deposits/bridges;
- forced migration of v1 accounts;
- mixing experimental privacy code into v1 bug-fix releases;
- marketing “full anonymity” without a measured end-to-end anonymity set.

---

## Appendix A — Constants and encoded limits

| Constant | Final value / rule | Notes |
|---|---|---|
| `BPS_DENOMINATOR` | `10_000` | shared by curve, fees and boards |
| `MIN_TOKEN_RESERVE` | `1_000` project atomic units | 0.000001 token at 9 decimals |
| `MIN_VIRTUAL_BASE` | `1` USDC atomic unit | denominator/nonzero floor at 6 decimals |
| curve `fee_bps` ceiling | `1_000` | 10%; fixed before activation |
| graduated LP fee target | `30` bps | Meteora DAMM v2 configuration, verified at creation |
| `MAX_PARTNER_BPS` | `5_000` | source parity |
| `MAX_SLUG_LENGTH` | `32` **bytes** | exactly one PDA seed, not 32 Unicode code points |
| `MAX_BODY_LENGTH` | `1_000` visible UTF-8 bytes | reply relation is typed, not counted in body |
| Merkle depth | `20` | 640-byte proof; hard reject deeper trees |
| split count | `8` | exactly the eight source categories |
| metadata URI | `200` bytes | image bytes never inline |
| sale duration | `1..=2_592_000` seconds | end required; maximum 30 days |
| tally review delay | `86_400` seconds | 24 hours; root may be voided before first settle |
| settlement grace | `604_800` seconds | success must begin within 7 days after end |
| refund review delay | `604_800` seconds | public emergency root review |
| minimum liquidity lock | `15_552_000` seconds | 180 days from activation; longer/permanent allowed |
| claim/refund expiry | none | valid rights remain claimable; no sweep |

All string caps are UTF-8 **bytes** at the instruction boundary. Frontend character
counters additionally show user-perceived characters, but only byte length determines
whether a transaction is valid.

## Appendix B — Solana platform limits used by this plan

| Limit / behavior | Planning value |
|---|---|
| serialized transaction | 1,232 bytes |
| default compute budget | 200,000 CU |
| maximum requested compute | 1,400,000 CU |
| PDA seeds | max 16 seeds, each max 32 bytes |
| account data | 10 MiB maximum; 10 KiB growth per instruction |
| slot target | approximately 400 ms; **not finality** |
| finalized commitment | typically about 32 rooted slots; measure and display actual state |
| SBF stack frame | 4 KiB |
| rent | cluster-dependent and refundable on close; always query RPC, never hardcode a SOL estimate |
| ALT activation | extended addresses are not usable until a later slot |

Limits are assertions in transaction-builder/integration tests, not comments. Values tied
to runtime versions are printed by `scripts/localnet.sh` and compared with the deployment
manifest.

## Appendix C — Source repository reference and precedence

**Repository:** `https://github.com/nickthelegend/norr-fun`  
**Pinned commit:** `5af8fcd103b7ca4dc45ec6485e5bdb685b0966ea`

Reference surfaces reviewed for this plan include all root manifests, PRODUCT/DESIGN,
contract directories and the core contracts, scripts, test inventory, App routing,
creation/private/discussion/earnings UI, deployment config, functional spec and browser
TESTPLAN. When source artifacts disagree, use this precedence:

1. executable contract/program behavior and passing tests;
2. current routed React UI and hooks;
3. current acceptance cases;
4. functional spec and prose docs;
5. stale README/deployment claims.

Known source inconsistencies intentionally fixed here:

- browser TESTPLAN enumerates 110 rows but reports 101;
- App has 19 `<Route>` entries (18 addressable plus wildcard), not 20;
- functional spec predates shipped market, promotion and social surfaces;
- README contained deployment addresses that returned no code/account;
- `package.json` has no working top-level `test` script;
- `scripts/ido/01_deploy_ido.ts.ts` has a doubled extension;
- `scripts/ido/10_hardcoded_decryptor.ts` contains a literal vault private key;
- no root LICENSE exists, while package metadata says ISC and files mix MIT/Ecosystem notices;
- the source browser stores a decryption key in localStorage;
- 12 kB inline logo data cannot fit a 200-byte account URI;
- the source market hardcodes 18 decimals and substitutes a block number for missing time;
- the source AMM-failure fallback and immediately withdrawable LP position are rejected.

**Target implementation stack:** Rust + Anchor programs; Vite 7, React 18, TypeScript,
Tailwind CSS 4, `@solana/kit`, wallet-adapter, Codama clients; TypeScript LaserStream
indexer + PostgreSQL; Node >= 20.19.

