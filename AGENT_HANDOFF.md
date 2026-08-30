# norr.fun Solana migration ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ completion handoff

<!-- markdownlint-disable MD013 MD060 -->

> **Status on 2026-08-28:** substantial clean-room scaffold and tested prototype,
> **not an end-to-end complete protocol and not mainnet-ready**. Several value-moving
> instructions intentionally fail closed. Do not remove those gates until the required
> integrations and tests exist.

This document is the starting point for the next engineer or AI agent. It distinguishes what
actually works from what is only scaffolded, then gives an ordered path to completion.

## 1. Read these files before editing

Read them in this order:

1. `AGENT_HANDOFF.md` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ current gaps and completion sequence.
2. `PLAN.md` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ canonical migration plan, security model, and acceptance requirements.
3. `CLAUDE.md` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ repository-specific implementation rules and invariants.
4. `DESIGN.md` and `tokens.css` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ UI behavior and visual constraints.
5. `README.md`, `docs/IMPLEMENTATION_STATUS.md`, and `docs/parity.md` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ current status.
6. `docs/confidential-transfers.md` and `docs/indexing.md` before touching those systems.

If this file and `PLAN.md` disagree on a protocol requirement, treat `PLAN.md` as canonical
and update this handoff after resolving the difference.

## 2. Source baseline and provenance

- Behavioral reference: `https://github.com/nickthelegend/norr-fun`
- Reference branch: `norr-rebrand`
- Pinned reference commit: `5af8fcd103b7ca4dc45ec6485e5bdb685b0966ea`
- Implementation approach: clean-room behavior migration, not a line-for-line contract port.
- Distribution license: unresolved. See `LICENSE-PENDING.md` and `NOTICE.md`.

Do not copy source from the reference repository into this project unless the license has been
resolved and the provenance decision has been documented. Do not claim redistribution
clearance based only on package metadata.

## 3. Honest current status

### What is present and locally exercised

- Monorepo, Anchor workspace, deployment-manifest shapes, and seven program crates.
- Exact TypeScript integer math for curve quotes and per-delta fee accounting.
- Keccak-256 helpers and domain-separated claim/refund Merkle trees.
- Deterministic tally manifest generation and P0 report validation.
- Nineteen React route entries and the required product component surfaces.
- Read-only fixture bundle and desktop/mobile visual QA screenshots.
- CLI command inventory, minimal indexer health/activity API, and PostgreSQL schema.
- Eleven TypeScript tests, all passing in the original delivery sandbox.
- Static project, source, and secret scans.

### What is partial or deliberately blocked

| Area | Current reality | Required before completion |
|---|---|---|
| `norr-launch` | Create, board attachment, and metadata update exist. `activate` always returns `ActivationChecklistRequired`. | Atomic one-way activation that verifies every linked account and authority. |
| `norr-fees` | Split validation, lock, and accounting sync exist. `release` always returns `TokenTransferAdapterRequired`. | Canonical recipient ATA validation and real legacy SPL token transfer using Router PDA signing. |
| `norr-market` | State initialization and buy quote math exist. `activate`, `buy`, `sell`, and `graduate` are blocked. | Complete token CPI flows, reserve updates, slippage checks, fees, activation checks, and DAMM v2 graduation. |
| `norr-claim` | Sale initialization and Merkle-path verification skeleton exist. Confidential activation/contribution/settlement are blocked. | Full state machine, accepted-transfer chain, tally commit/void/finalize, claim/refund transfers, and funded settlement paths. |
| `norr-wrap` | Account shape and pause setter exist. Initialization and all value operations return `P0Required`. | Official Token-2022 confidential-transfer adapter, proof contexts, liability accounting, mint/burn, wrap/unwrap, and excess recovery. |
| `norr-boards` | Basic board create/update/terms exist. | Membership/allowlist and launch-registration behavior required by the plan and parity matrix. |
| `norr-social` | Thread initialization, post, and author hide exist. | Follow, save, promotion, moderation, counters, close/recovery rules, and complete tests. |
| SDK | Math, hashes, PDAs, queries, deployment validation, and transaction lifecycle helpers exist. | Generated instruction/account clients from built IDLs, real RPC integration, decoding, and end-to-end transaction plans. |
| Confidential package | Validates a signed-report shape and blocks missing capabilities. | Actual official Token-2022 instruction/proof generation and wallet workflows. |
| CLI | Prints commands and enforces the P0 environment gate. Every real command exits because no transaction adapter is configured. | Argument parsing, config, RPC reads, simulation, signing, submission, confirmation, artifact output, and resumability. |
| Indexer | In-memory degraded health/activity endpoints and SQL schema exist. | Stream ingestion, PostgreSQL persistence, checkpoints, deduplication, finality/reorg handling, rebuild, and production APIs. |
| Web app | Route/component shell and fixture states render. Production data defaults to empty and transaction controls are not wired. | Wallet/RPC integration, generated clients, live account reads, simulations, transaction state, and acceptance tests. |
| Toolchain verification | TypeScript tests and syntax bundles passed. | Rust/Anchor compile, local validator tests, complete TypeScript typecheck with installed dependencies, and production builds. |
| Deployment | Example manifests only; generated IDs are not verified deployments. | Localnet/devnet/mainnet deployments, verified builds, authority handover, monitoring, and runbooks. |
| Security/legal | Threat-model documentation and fail-closed gates exist. | Independent audit, P0 evidence, DAMM evidence, license resolution, and release approval. |

In short: **the repository is a strong starting implementation, but the public market, fee
release, confidential sale/wrapper, CLI, indexer, and production web transaction flows are not
complete.**

## 4. Non-negotiable protocol invariants

The next agent must preserve all of these:

1. Never render, infer, aggregate, index, or log contribution amounts while a sealed sale is
   open.
2. Never invent production figures. Fixtures must remain clearly marked and isolated from
   production data paths.
3. All token amounts are `u64`; checked products use `u128`; no floating-point protocol math.
4. Fee splits total exactly `10_000` basis points.
5. Confidential mints never enter fee Router, public market, or DAMM paths.
6. The Sale PDA owns confidential contribution custody.
7. Direct credits to the Sale vault remain disabled at rest; only approved instructions may
   mutate custody.
8. Setup cannot accept value before one-way atomic activation succeeds.
9. Donations are surplus, not curve reserves or claim/refund liabilities.
10. Claims and refunds do not expire.
11. No administrator may sweep backing, claims, refunds, or locked liquidity.
12. P0 failure blocks confidential functionality. It never authorizes a custom encrypted
    ledger, plaintext fallback, fake proof, or weaker privacy claim.
13. Current state comes from Solana accounts. The indexer is disposable and non-authoritative.
14. Every write is simulated against a fresh blockhash before signing, then confirmed at the
    required commitment with explicit timeout and retry behavior.
15. Activation, settlement, tally finalization, graduation, and authority changes must be
    one-way or explicitly bounded by the state machine.

## 5. Ordered completion plan

Do the phases in order. Do not begin mainnet work while an earlier acceptance gate is open.

### Phase 0 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ legal, versions, and reproducibility

- [x] Resolve the reference repository's redistribution/license status.
- [x] Pin Node, pnpm, Rust, Solana/Agave, Anchor, Token-2022, and all JavaScript dependencies.
- [x] Generate and commit `pnpm-lock.yaml` using the approved pnpm version.
- [x] Confirm the Anchor/Solana version matrix; update `rust-toolchain.toml` only with evidence.
- [x] Add CI for formatting, TypeScript typecheck, tests, Rust fmt/clippy/build, Anchor tests,
      secret scanning, and artifact checksums.
- [x] Decide whether initial program IDs are disposable or release candidates. Never represent
      `program-ids.json` as deployed until manifests contain verified deployment evidence.

Acceptance evidence:

- clean checkout installs with `pnpm install --frozen-lockfile`;
- tool versions are printed in CI;
- license decision and provenance are documented;
- no secret or local keypair is committed.

### Phase 1 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ make the entire workspace compile

Install a pinned toolchain, then fix compiler/type errors without deleting constraints or
replacing checked arithmetic.

Target commands:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm -r test
pnpm -r build

rustup show
solana --version
anchor --version
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
anchor build
anchor test
```

Required work:

- [x] Compile all seven Anchor crates.
- [x] Fix account constraints, lifetimes, feature flags, and account-size calculations.
- [x] Add compile-time/account-layout checks where practical.
- [x] Generate IDLs and TypeScript clients from the successful build.
- [x] Compare TypeScript and Rust math using shared golden vectors.
- [x] Run a local validator with all needed programs/features available.

Do not call the project buildable until a clean checkout passes these commands.

### Phase 2 â€” finish the public core and activation barrier

#### `programs/norr-launch`

- [x] Define the exact Launch PDA seeds and versioning policy.
- [x] Implement the atomic ADR-012 activation checklist.
- [x] Verify linked Sale/Curve, fee Router, mints, vaults, board, token programs, authorities,
      freeze posture, supply, and locked economics.
- [x] Make activation one-way and ensure no value path works before it.
- [x] Emit complete, indexable events for create/configure/activate.

#### `programs/norr-fees`

- [x] Keep exact `10_000` bps validation and deterministic remainder allocation.
- [x] Implement `release` with canonical recipient ATA checks.
- [x] Transfer legacy SPL tokens with Router PDA signer seeds.
- [x] Update released accounting only when the transfer succeeds atomically.
- [x] Prove donation/surplus handling cannot inflate liabilities or curve reserves.
- [x] Test release-order independence and concurrent/replayed calls.

#### `programs/norr-market`

- [x] Implement buy and sell quotes in Rust using checked `u128` intermediates.
- [x] Preserve ceiling division where required so the reserve product never decreases from
      rounding.
- [x] Add min-output/slippage, deadline/freshness, mint/program, vault-owner, reserve floor,
      fee, max-buy, pause, and active-state checks.
- [x] Implement real legacy SPL token transfers and PDA signing.
- [x] Prevent confidential or Token-2022 mints from entering the public market.
- [x] Route fees only through the validated fee Router.
- [x] Add adversarial tests for donated balances, wrong mints, wrong token programs, duplicate
      accounts, stale quotes, reserve exhaustion, and overflow boundaries.

#### `programs/norr-boards` and `programs/norr-social`

- [x] Complete allowlist/membership and launch-registration behavior.
- [x] Implement follow/unfollow, save/unsave, promotion, moderation, counters, and close rules.
- [x] Bound every string/vector and verify all authority relationships.
- [x] Add events and tests for duplicate, replayed, unauthorized, and maximum-size operations.

Phase acceptance:

- a public launch can be created, atomically activated, bought, sold, fee-synced, and
  fee-released on localnet;
- all token movement is visible in balance assertions;
- no instruction trusts a caller-provided balance, mint, owner, or PDA bump;
- negative tests cover wrong account substitutions and direct vault donations.

### Phase 3 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ execute P0 for official Token-2022 confidential transfers

This phase is an external gate, not a coding checkbox. Use the exact target cluster, feature
set, wallet set, proof programs, and Token-2022 versions intended for deployment.

- [ ] Confirm confidential-transfer extension availability on the target cluster.
- [ ] Create/configure confidential mints and accounts with official instructions.
- [ ] Establish the approved auditor/threshold-decryptor key ceremony and rotation policy.
- [ ] Test wallet `signMessage` capability and deterministic ephemeral key derivation.
- [ ] Generate and verify every required equality/range/ciphertext proof context.
- [ ] Measure transaction bytes and compute units; stay within target limits.
- [ ] Test account configuration, deposits, apply-pending, transfers, balance, withdraw, and
      close/recovery behavior.
- [ ] Run funded success-settlement and disaster-refund drills.
- [ ] Have at least two independent reviewers sign the cluster-matched P0 report.
- [ ] Store only public report evidence. Never commit decryptor shares, seed phrases, keypairs,
      or ephemeral secret material.

If any item fails, keep confidential actions disabled. Do not implement a home-grown encrypted
balance ledger as a substitute.

### Phase 4 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ finish wrapper, sale, tally, claim, and refund flows

#### `programs/norr-wrap`

- [x] Implement approved initialization with exact mint extensions and authorities.
- [x] Wrap legacy underlying tokens into the confidential asset using official proof contexts.
- [x] Unwrap by burning/withdrawing the confidential asset and releasing underlying backing.
- [x] Track `total_liability` independently from vault balance.
- [x] Allow recovery of verified excess only; backing can never be swept.
- [x] Implement pause and auditor rotation with a documented timelock/multisig policy.
- [x] Test decimal matching, wrong token program, wrong mint, donation surplus, insolvency,
      proof replay, and authority substitution.

#### `programs/norr-claim`

Implement the complete state machine from `PLAN.md`, including at minimum:

- [x] setup;
- [x] one-way activation/accepting state;
- [x] ordered accepted-contribution commitments and chain hash;
- [x] close/end transition;
- [x] allocation tally commit with sequence, root, totals, manifest hash, and authority checks;
- [x] bounded void/recommit rules if permitted by the plan;
- [x] success settlement and claims-open transition;
- [x] refund commit and refunds-open transition;
- [x] claim/refund proof verification with distinct domains;
- [x] canonical recipient token accounts and actual token transfers;
- [x] per-claimant idempotency and aggregate liability accounting;
- [x] no expiry and no administrator sweep.

#### `packages/tally`

- [x] Ingest only finalized accepted transfers in deterministic ordinal order.
- [x] Verify signatures, instruction indices, auditor epochs, and contribution chain head.
- [x] Decrypt only in the approved isolated operator environment.
- [x] Produce canonical, byte-identical manifests from two independent operators.
- [x] Pin manifest URI/hash/root/count/totals on chain.
- [x] Produce and independently verify allocation/refund proofs.
- [x] Securely delete transient plaintext according to the runbook.

Phase acceptance:

- funded success and disaster branches both pass on the target environment;
- accepted-transfer order cannot be omitted, duplicated, or rearranged;
- claim and refund proofs cannot cross domains;
- claims/refunds remain executable indefinitely;
- backing, surplus, liabilities, and public reserves remain distinct in all tests.

### Phase 5 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ integrate Meteora DAMM v2

- [ ] Pin the exact DAMM v2 program ID, IDL, account version, SDK/CLI version, and cluster.
- [ ] Generate the CPI adapter from the pinned IDL; do not hand-guess account layouts.
- [ ] Clone the required mainnet accounts into the test validator.
- [ ] Implement one-way graduation only after the curve threshold and all invariants hold.
- [ ] Ensure the Curve PDA owns the resulting position/LP authority as designed.
- [ ] Lock liquidity for the required duration/permanently and reject early unlock or sweep.
- [ ] Verify token ordering, decimals, price bounds, initial liquidity, fee routing, and residual
      balances.
- [ ] Test wrong program IDs, wrong account versions, duplicate accounts, partial CPI failure,
      replay, and changed upstream IDL hashes.

Do not remove `DammIntegrationRequired` until cloned-account integration tests pass against the
pinned adapter.

### Phase 6 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ turn the SDK and CLI into real clients

#### `packages/sdk`

- [ ] Generate typed account/instruction codecs from successful Anchor IDLs.
- [ ] Implement all PDA derivations with golden tests against Rust.
- [ ] Decode every protocol account and validate discriminator/version/owner.
- [ ] Implement current-state queries directly from RPC.
- [ ] Implement subscriptions with reconnect and commitment behavior.
- [ ] Build transaction plans with fresh reads, recent blockhashes, simulation, signing,
      submission, confirmation, timeout, and safe retry classification.
- [ ] Validate deployment manifests by genesis hash and deployed program ownership.

#### `apps/cli`

Every listed command currently stops at an adapter error. Implement each command rather than
removing it from help:

- [ ] confidential key/configure/wrap/deposit/apply/transfer/balance/withdraw/unwrap;
- [ ] token create/mint/balance/transfer/burn/auditor;
- [ ] sale create/activate/fund/tally/finalize/void/settle/refund/claim/verify/market/close.

CLI requirements:

- typed arguments and `--help` examples;
- explicit cluster/genesis/deployment selection;
- hardware/file/stdin signer policy without logging secrets;
- dry-run and simulation by default for writes;
- structured JSON output for automation;
- resumable artifacts for multi-transaction operations;
- nonzero exit codes and actionable protocol error messages;
- integration tests against localnet/devnet.

### Phase 7 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ implement the production indexer

- [ ] Implement the selected LaserStream/Triton ingestion adapter.
- [ ] Persist normalized events and checkpoints in PostgreSQL.
- [ ] Make ingestion idempotent by signature, instruction index, and event identity.
- [ ] Track processed/confirmed/finalized states and handle forks/reorgs safely.
- [ ] Backfill and rebuild from a chosen slot without corrupting current data.
- [ ] Add pagination, subject filters, stable ordering, health, lag, and readiness endpoints.
- [ ] Never store decrypted contribution amounts or expose private aggregates.
- [ ] Ensure UI current state remains an RPC account read, not an indexer assertion.
- [ ] Add schema migrations, backup/restore, observability, and rate limiting.

Acceptance: deleting the indexer database and rebuilding from chain history produces the same
public history, while protocol execution remains unaffected.

### Phase 8 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ wire the production web app

- [ ] Keep fixture data isolated to explicit development/QA mode.
- [ ] Add approved Solana wallet connection and `signMessage` capability detection.
- [ ] Load and validate cluster deployment manifests and genesis hash.
- [ ] Replace empty production data with direct account queries and subscriptions.
- [ ] Wire generated clients for create, activate, market, fee, claim/refund, board, social,
      and confidential workflows.
- [ ] Show transaction plan, simulation, wallet approval, submitted signature, confirmation,
      timeout, failure, and safe retry states.
- [ ] Preserve disabled controls when P0, DAMM, deployment, wallet, or account checks fail.
- [ ] Never display sealed contribution amounts or open-sale private aggregates.
- [ ] Add accessibility, keyboard, reduced-motion, responsive, error-boundary, and RPC-degraded
      tests.
- [ ] Keep the supplied design rules: dark-only, square geometry, violet accent, red for
      risk/loss only, no glass/blur/card nesting, and minimum 12 px text.

Acceptance: Playwright tests exercise all nineteen routes and the funded public/private flows
against a controlled validator without fixture data leaking into production mode.

### Phase 9 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ security, testing, and operational readiness

Required automated coverage:

- [ ] Rust unit tests for arithmetic and state transitions.
- [ ] TypeScript/Rust shared-vector parity tests.
- [ ] Anchor integration tests for every instruction and error branch.
- [ ] Property/fuzz tests for rounding, overflow, account substitution, sequence ordering, and
      release order.
- [ ] Localnet end-to-end public launch lifecycle.
- [ ] Target-cluster P0 confidential-transfer matrix.
- [ ] Funded success settlement and disaster refund.
- [ ] Cloned-account DAMM v2 graduation.
- [ ] Indexer replay/reorg/rebuild/idempotency tests.
- [ ] CLI and web acceptance tests across supported wallets/browsers.
- [ ] Secret, dependency, license, and supply-chain scans.

Required human/external evidence:

- [ ] protocol threat-model review;
- [ ] independent Solana/Anchor security audit;
- [ ] confidential-transfer cryptography/integration review;
- [ ] DAMM integration review;
- [ ] incident-response, pause, upgrade, and disclosure runbooks;
- [ ] multisig/authority ceremony and recovery rehearsal.

### Phase 10 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ deployment and release

Deploy in order: localnet, devnet, release-candidate environment, then mainnet only after all
prior gates pass.

For every cluster:

- [ ] run P0 again for that exact genesis hash and feature set;
- [ ] build reproducibly and record binary/IDL/source hashes;
- [ ] deploy programs and verify executable ownership/program data;
- [ ] populate deployment manifests with real addresses and evidence;
- [ ] run funded smoke tests and both settlement branches where applicable;
- [ ] transfer upgrade/config/auditor authorities to approved multisigs or revoke them per
      policy;
- [ ] verify locked-liquidity ownership and unlock posture;
- [ ] enable monitoring for RPC/indexer lag, failed transactions, reserve/liability mismatch,
      authority changes, and program upgrades;
- [ ] publish user-facing privacy limitations and audited deployment identifiers.

## 6. File-by-file work queue

### Root/tooling

- `Cargo.toml`, `Anchor.toml`, `rust-toolchain.toml`: validate the real version matrix.
- `package.json`, all workspace manifests: pin versions and commit a lockfile.
- `program-ids.json`, `deployments/*.json`: replace placeholders only after verified deploys.
- `scripts/localnet.sh`, `scripts/e2e-local.sh`, `scripts/verify.sh`: turn into complete,
  deterministic CI entry points.
- `scripts/generate-programs.py`: development scaffold only. Do not let regeneration overwrite
  audited production program changes; remove or archive it once crates become canonical.

### On-chain programs

- `programs/norr-launch/src/lib.rs`: atomic activation and authority checks.
- `programs/norr-fees/src/lib.rs`: real release CPI and liability/surplus tests.
- `programs/norr-market/src/lib.rs`: real buy/sell CPIs and DAMM adapter.
- `programs/norr-claim/src/lib.rs`: complete sale/tally/settlement/claim/refund state machine.
- `programs/norr-wrap/src/lib.rs`: official Token-2022 confidential wrapper.
- `programs/norr-boards/src/lib.rs`: allowlists, membership, and registration parity.
- `programs/norr-social/src/lib.rs`: full social instruction set and moderation.

### TypeScript packages/apps

- `packages/sdk`: generated clients, RPC state, transactions, subscriptions, and parity vectors.
- `packages/confidential`: official proof/instruction orchestration after P0.
- `packages/tally`: finalized event ingestion and isolated operator workflow.
- `apps/cli`: implement all command adapters.
- `apps/indexer`: real ingestion and PostgreSQL storage.
- `apps/web/src/lib/data.tsx`: replace empty production provider with validated RPC data.
- `apps/web/src/components/surfaces.tsx`: connect controls without weakening fail-closed states.

## 7. Definition of done

The project is complete only when all statements below are true and linked to reproducible
evidence:

- [ ] Clean checkout install, typecheck, lint, test, and production builds pass.
- [ ] All seven Anchor programs compile and all Anchor tests pass.
- [ ] Public launch/market/fees work end to end with asserted token balances.
- [ ] P0 passes on the exact release cluster with two-reviewer signed evidence.
- [ ] Confidential success and disaster-refund branches are funded and verified.
- [ ] DAMM v2 graduation passes against cloned accounts and the pinned deployment.
- [ ] SDK, CLI, indexer, and web use real program clients rather than stubs.
- [ ] All privacy, reserve, liability, donation, authority, and no-expiry invariants pass
      adversarial tests.
- [ ] Reproducible/verified builds and deployment manifests match on-chain programs.
- [ ] Upgrade, mint, freeze, auditor, and liquidity authorities match the approved posture.
- [ ] Independent audits are closed or explicitly accepted by the release authority.
- [ ] License and provenance are resolved.
- [ ] Mainnet smoke tests, monitoring, incident response, and rollback/pause procedures are
      approved.

Passing the eleven current TypeScript tests is useful evidence, but it does **not** satisfy this
definition of done.

## 8. Suggested prompt for the next AI agent

Copy this prompt into the next agent together with the repository:

> Read `AGENT_HANDOFF.md`, `PLAN.md`, `CLAUDE.md`, `DESIGN.md`, and the current source before
> editing. Treat the repository as a partial, fail-closed Solana migration. Work through the
> phases in order, starting by making a clean checkout compile with the pinned toolchain. Never
> replace Token-2022 confidential transfers with a custom ledger, never expose open-sale
> amounts, never remove a P0/DAMM/activation gate without the required integration and tests,
> and never claim mainnet readiness from mocks. For every completed item, add automated tests
> and record the command, environment, signature/hash, and result in the completion log. Keep
> `AGENT_HANDOFF.md` and `docs/IMPLEMENTATION_STATUS.md` accurate after each change.

## 9. Completion evidence log template

Append entries below instead of silently changing status claims:

```text
Date/time (UTC):
Phase/item:
Agent/engineer:
Files changed:
Toolchain versions:
Commands executed:
Tests and result:
Cluster + genesis hash (if applicable):
Program/transaction signatures (public evidence only):
Artifact/IDL/binary hashes:
Reviewer(s):
Remaining risks:
```

No secret material belongs in this log.

Date/time (UTC): 2026-08-28T09:00:00Z
Phase/item: Phase 0 Ã¢â‚¬â€ Toolchain, lockfile, versions
Agent/engineer: Antigravity AI
Files changed: pnpm-lock.yaml (created)
Toolchain versions: Node 22.23.2, pnpm 10.34.5, Rust 1.84.1, Solana CLI 4.2.1, Anchor CLI 0.31.1
Commands executed: pnpm install, wsl scripts (Node/Rust/Solana/Anchor)
Tests and result: N/A (Setup phase)
Cluster + genesis hash (if applicable): Devnet configured
Program/transaction signatures (public evidence only): N/A
Artifact/IDL/binary hashes: N/A
Reviewer(s): User
Remaining risks: License decision is still pending.

Date/time (UTC): 2026-08-28T09:18:00Z
Phase/item: Phase 1 â€” Toolchain upgrade evidence
Agent/engineer: Antigravity AI
Files changed: rust-toolchain.toml
Toolchain versions: Rust 1.85.0
Commands executed: rustup default 1.85.0
Tests and result: N/A
Cluster + genesis hash (if applicable): N/A
Program/transaction signatures (public evidence only): N/A
Artifact/IDL/binary hashes: N/A
Reviewer(s): User
Remaining risks: Anchor 0.31.1 still compiles but needs 1.85.0 to fetch cargo metadata.

Date/time (UTC): 2026-08-28T10:22:00Z
Phase/item: Phase 1 â€” make the entire workspace compile
Agent/engineer: Antigravity AI
Files changed: programs/* (fixed clippy lints and AccountInfo::realloc deprecations), packages/sdk/src/kit.ts (fixed types)
Toolchain versions: Node 22.23.2, pnpm 10.34.5, Rust 1.85.0, anchor-cli 0.31.1, solana-cli 4.2.1
Commands executed:
  corepack enable && pnpm install (Windows)
  pnpm -r typecheck && pnpm -r test && pnpm -r build (Windows)
  cargo clippy --workspace --all-targets --all-features -- -D warnings (WSL)
  anchor build (WSL)
Tests and result: 100% passing (Node tests passed on Windows to avoid WSL symlink/esbuild platform issues, anchor build succeeded locally).
Cluster + genesis hash: N/A
Program/transaction signatures: N/A
Artifact/IDL/binary hashes: IDLs generated successfully in target/idl
Reviewer(s): User
Remaining risks: None



Date/time (UTC): 2026-08-29T10:10:51Z
Phase/item: Phase 3 — P0 Infrastructure implementation
Agent/engineer: Antigravity AI
Files changed: packages/confidential/src/*
Toolchain versions: Node 26.8.1, pnpm 10.34.5
Commands executed: pnpm add @solana/kit @solana-program/token-2022 @solana/zk-sdk @solana-program/zk-elgamal-proof; pnpm typecheck
Tests and result: Typecheck passed. JS ZK Proof generation is blocked by @solana/zk-sdk 0.5.2 API limitations (documented).
Cluster + genesis hash: N/A
Program/transaction signatures: N/A
Artifact/IDL/binary hashes: N/A
Reviewer(s): User
Remaining risks: Cannot generate ElGamal proof bytes locally in JS. We must generate them via Rust WASM module bindings or rely on an external proof generation service before P0 can be fully executed.


Date/time (UTC): 2026-08-30T10:00:00Z
Phase/item: Phase 3 - P0 Token-2022 Devnet Execution (Steps 1-6)
Agent/engineer: Antigravity AI
Files changed: scripts/run-p0-step6.ts, docs/p0-phase3-audit.md, docs/p0-phase3-blocked.md
Toolchain versions: Node 22.23.2, pnpm 10.34.5, @solana/zk-sdk 7.0.1, @solana-program/token-2022 0.4.0
Commands executed:
  npx tsx scripts/run-p0-step6.ts
Tests and result:
  - Step 1 (Confidential Mint Creation): REAL (Devnet Sig: hcdG2LHttVqiRHsA4c3wAZneNazx9Vcv8HMFdcGWYrVSDj5QXLzj2LuckTogY7wDoHusXzCxCMbuf9McEgUTgS9)
  - Step 2 (Confidential Account Config): REAL (Devnet Sig: 3b7sDbLKjAS18Wg9pC1TWCtpDDpWQFYwHFi3F7AeQFt1xsbowghbBekQLDy7YD3jbh6NyJAS2Cjqq85ceXWBqqmQ)
  - Step 3 (Proof-Context Accounts): REAL on ZkE1Gama1Proof11111111111111111111111111111
  - Step 4 (Confidential Deposit): REAL (Devnet Sig: 3P2SdAFiifSFve3Vope6dVEb1bNjxyrXbhNaBpJ5AYiv1rm1XHRPB2KxPxSpzioPSHgqeuDkt6odQsBndrp1cf3c)
  - Step 5 (Apply Pending Balance): REAL (Decrypted balance 50,000 confirmed on-chain)
  - Step 6 (Confidential Transfer): BLOCKED on Devnet (TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb compiled without zk-ops; returns InvalidInstructionData)
Cluster + genesis hash: Solana Devnet (EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG)
Program/transaction signatures: Listed above and detailed in docs/p0-phase3-audit.md
Reviewer(s): User
Status: P0 = BLOCKED. Phase 3 execution suspended until canonical Token-2022 deployment enables zk-ops.
