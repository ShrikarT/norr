# Norr — Final Readiness Audit

**Date:** 2026-08-30
**Method:** direct code inspection + live Devnet RPC verification (`https://api.devnet.solana.com`).
Previous agent reports were **not** trusted; every claim below was re-verified against the
repository and the cluster.

---

## Headline findings

1. **The 7 "Devnet canonical" program IDs are NOT deployed.** `getAccountInfo` returns
   `null` and `getSignaturesForAddress` returns zero history for every one of
   `norr-launch/market/fees/boards/social/claim/wrap`. README, SUBMISSION_STATUS,
   `deployments/devnet.json` (`status: canary`) and the web UI all presented these as live
   Devnet programs. **This was the single largest honesty gap in the repository.**
2. **The confidential-transfer evidence IS real.** Verified live: mint
   `6RBs…9suT` (owner Token-2022, CT mint extension), token account `HKrZ…RSMm`
   (CT account extension, encrypted balance ciphertexts present), three ZK proof context
   accounts owned by `ZkE1Gama1Proof1111…` (216 B equality, 516 B validity, 396 B range),
   and both cited transactions confirmed with `err: null`.
3. **The zk-ops blocker is real and current.** Re-probed live during this audit: a
   `ConfidentialTransferInstruction::Transfer` simulation against the canonical Token-2022
   program on Devnet still logs `ConfidentialTransferInstruction::Transfer` →
   `Error: InvalidInstructionData` (program compiled without `zk-ops`).
4. **The web app repeatedly faked success.** Claim, launch creation, desk creation, desk
   follow, fee release, and discussion posting all showed "Confirmed on Devnet" toasts from
   `setTimeout` — no transaction existed. The market trade path submitted a real transaction
   to a **non-existent program** with structurally wrong accounts (user key reused as token
   accounts, program IDs reused as PDAs).

---

## Feature audit table

| Feature | Current implementation | Actually works? | Evidence | Problems | Recommended fix | Priority |
|---|---|---|---|---|---|---|
| Anchor programs (7 crates) | Complete Anchor source, 2,480 lines, fail-closed `P0Required` on private paths | Compiles (per history); **not deployed** to any cluster | `getAccountInfo` = null for all 7 IDs; zero signature history | Docs claim Devnet deployment; `norr-claim` `declare_id` (`C1aim1…`) ≠ manifest ID (`68AW7…`) | Fix `declare_id`; docs/manifests must say "not yet deployed"; UI must detect deployment live | **CRITICAL** |
| Web: market buy/sell | Builds real ix via SDK, sends via wallet | No — program missing; accounts wrong (user key as ATA, program ID as curve/vault); fake "Simulated Execution Verified" fallback | `surfaces.tsx` line 39 | Guaranteed failure presented as tradable market; fake fallback toast | Gate on live program-deployment check; remove fake fallback; keep exact quote math as labeled reference curve | **CRITICAL** |
| Web: claim (`IdoClaim`) | `setTimeout` → "Claim Verified … claimed successfully on Devnet" | No — pure fiction | `surfaces.tsx` line 37 | Fake success | Replace with honest gated state + real Merkle verification of local proofs | **CRITICAL** |
| Web: create launch | `setTimeout` → "Launch Created on Devnet" | No | line 50 | Fake success | Real plan/simulate path, disabled with reason while program undeployed | **CRITICAL** |
| Web: desks create/follow | `setTimeout` → "Desk Created/Followed … on Devnet" | No | lines 51–52 | Fake success | Same treatment | **CRITICAL** |
| Web: fee release | `setTimeout` → "$42.50 USDC transferred" | No | line 55 | Fake success + invented amount | Honest empty/gated state | **CRITICAL** |
| Web: discussion | Local state append → "Signed post confirmed on Devnet" | No | line 41 | Fake on-chain claim; seeded fake comments with fake slots | Honest thread state; posting gated on deployment | **CRITICAL** |
| Web: proof verifier | `alert("Root verified on-chain…")` | No | line 36 | `window.alert` fake verification | Real local Merkle verification using `@norr/sdk` (`MerkleTree`/`verifyMerkleProof`) | HIGH |
| Web: feed/compare/holders/leaderboard/activity/portfolio token rows/profile stats | Hardcoded fixtures ($2.46M mcap, 12,500 NSTAR, 14 followers, fake slots) presented as live | No | `lib/data.tsx`, lines 42–57 | Fixtures presented as cluster state | Label reference catalog explicitly as sample; drive wallet/activity views from real RPC | **CRITICAL** |
| Web: RPC status | Real `getSlot` poll | Yes | `lib/data.tsx` | No genesis-hash verification (claims devnet identity without checking); indexer probe hardcoded to localhost causing console noise in prod | Verify genesis live; only probe indexer when configured | HIGH |
| Web: wallet | wallet-adapter + Wallet Standard autodetect | Yes (real) | `WalletContextProvider.tsx` | Dead duplicate mock wallet in `lib/wallet.tsx` inventing `DemoWallet1111…` | Delete mock | HIGH |
| Web: portfolio balance | Real `getBalance` | Yes | line 53 | Mixed with fake "12,500 NSTAR" row | Real `getParsedTokenAccountsByOwner`; drop fixture row | HIGH |
| SDK math/merkle/tx-plan | Exact bigint curve math, keccak Merkle (depth-20, domain-separated), acyclic tx plan with simulate-before-sign | Yes — 11/11 tests pass | `pnpm -r test` | none material | keep | — |
| SDK instruction builders | Anchor discriminators + account layouts for all 7 programs | Builds correct bytes; unverifiable on-chain until deploys | tests | none | keep | — |
| Confidential package | Real Token-2022 ix orchestration via `@solana-program/token-2022`; key derivation (PBKDF2 → ElGamal/AE); proofs delegated to Rust tool | Setup path proven on Devnet (Steps 1–5) | live account verification above | JS proof generation impossible in pinned `@solana/zk-sdk` (documented, throws honestly) | keep; keep fail-closed | — |
| Programs: fail-closed P0 gate | `norr-wrap` wrap/unwrap/recover and `norr-claim` private paths return `P0Required` | Yes (by construction) | source | none — this is correct | preserve | — |
| Indexer | In-memory + pg store, /health | Runs locally | tests | Optional; never authoritative (correct posture) | keep | LOW |
| CLI | Quote/help real; write commands are stubs printing plans | Partially | source | Honest about simulation-first | keep, document | LOW |
| Tests | 22 passing (sdk 11, confidential 4, tally 1, indexer 1, cli 3, invariants 2) | Yes | test run | README says "23" | Fix count | LOW |
| Docs | README/SUBMISSION claim "deployed & verified" programs | **Misleading** | live RPC | see headline #1 | Rewrite honestly | **CRITICAL** |
| Repo hygiene | 40 one-line stub component files; unused vendored router; `fixture/` static prototype; root `tokens.css` duplicate with migration commentary; `fix.sh`; `package-lock.json` in a pnpm repo; personal `/home/shrikar` + `c:/Users/Shrikar` paths in scripts/docs | — | inspection | AI-scaffold smell | Delete/clean | MEDIUM |
| Rust toolchain checks | `cargo fmt/clippy`, `anchor build/test` | **Not runnable in this environment** (no Rust toolchain, 1 GB RAM sandbox) | — | — | documented honestly; run in CI/dev box | MEDIUM |

## Classification summary

- **CRITICAL (fixed in this pass):** false deployment claims, all fake-success UI paths,
  fixture data presented as live, market path with wrong accounts, `declare_id` mismatch.
- **HIGH (fixed):** genesis verification, mock wallet removal, portfolio/activity real reads,
  proof verifier realness, indexer probe noise.
- **MEDIUM (fixed):** repo hygiene, personal paths, docs consistency.
- **Blocked upstream (kept fail-closed, clearly labeled):** confidential
  `Transfer`/`Withdraw` execution — canonical Token-2022 on all public clusters is compiled
  without `zk-ops`. A locally built Token-2022 with `zk-ops` is a legitimate isolated
  integration target, but it requires the Rust/Agave toolchain which this environment cannot
  host; that work is documented as the next step, not claimed as done.
