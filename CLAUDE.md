# CLAUDE.md — norr.fun (Solana)

Agent operating rules for this repository. Read this file first, then `PLAN.md`.
`PLAN.md` is the final specification. This file is how to behave while implementing it.
The ADRs and §17 are authoritative; §18 is dated research context.
**Never let a confidential mint reach a DEX-facing path** — §2 invariant 11, §15 I-20.
**Never let an EOA/operator own a Sale vault** — §2 invariant 12, §15 I-38.
**Never accept a direct Sale-vault credit** — §2 invariant 13, §15 I-39.
**Never activate mutable economics or mint authority** — ADR-012, I-41/I-45.

---

## 1. What this repo is

A Solana port of `github.com/nickthelegend/norr-fun` (Avalanche / Solidity / Hardhat),
pinned at commit `5af8fcd`. Programs are **Rust + Anchor** and the application is **Vite 7 + React 18 + TypeScript + Tailwind 4**. Parity is **feature-for-feature, not line-for-line**:
every contract, script, route, component, doc and test in the source repo has a named
counterpart in `PLAN.md` §16 (Parity Checklist). Nothing in the source is dropped
silently — if something is not ported, it is listed in `PLAN.md` §16.4 with a reason.

The product: **private contribution, public settlement.** A token raise where
contribution amounts stay sealed while the sale runs, and settlement is committed
on-chain where anyone can verify their own allocation.

---

## 2. Invariants — do not break these

These are carried over from the source repo's `PRODUCT.md` and `DESIGN.md`. They are
product decisions, not preferences. If a task appears to require breaking one, stop
and raise it instead of working around it.

1. **Never render, aggregate, infer or log a contribution amount while a sale is open.**
   Not in the UI, not in a tooltip, not in a debug log, not in a program event. Leaking
   it defeats the entire product.
2. **No figure the chain does not produce.** No client-side vote counts, no holder count
   on a sealed round, no 24h change on a launch younger than a day. If the network did
   not agree on it, the surface does not print it.
3. **No progress bar without its denominator.**
4. **Splits must total exactly 10 000 bps.** Reject anything else at the instruction
   boundary. A silently under-allocated split strands funds with no owner.
5. **`lock()` is one-way and must be truthful.** See `PLAN.md` ADR-005 — an upgradeable
   program makes this promise false, so the program authority posture is part of the
   feature, not an ops detail.
6. **Amounts are `u64` at token precision.** Format lossily for display only. Never let a
   formatted string round-trip back into an instruction argument.
7. **Every write needs a pending state and a failed state.** Wallet rejection, blockhash
   expiry and simulation failure are all normal, not exceptional.
8. **Dark-exclusive, square, hairline-ruled, monospace figures, one accent.** See
   `DESIGN.md`. The accent is now Solana violet; everything else about the system is
   unchanged and was deliberately preserved.

---

## 3. Build order — do not skip ahead

Phases are defined in `PLAN.md` §14 with acceptance criteria. They are ordered by risk,
not by convenience.

```
P0  Spike: CT, credit gate, context binding, DR refund <- BLOCKING
P1  Public core: launch, fees, boards, activation
P2  Sealed layer: wrap, claim, hash chain, settle/refund
P3  Market: ceil-rounded curve + locked DAMM v2 position
P4  Social + promotion
P5  React frontend + TypeScript indexer
P6  Hardening, verified build, authority handover
```

**P0 is a hard gate.** Do not write a line of `norr_wrap` or any UI that assumes
confidential transfers until P0's acceptance criteria pass on the target cluster. If P0 fails, private mainnet is blocked. Do not substitute a custom balance ledger or
quietly weaken the privacy claim; record the failed gate and escalate.

---

## 4. Conventions

### Rust / Anchor

- Anchor workspace. One program per domain under `programs/`. Never a single mega-program.
- Every account struct starts with the Anchor discriminator. Put fixed-size, filterable
  fields **before** any variable-length field so `getProgramAccounts` `memcmp` offsets
  are stable. This is load-bearing — see ADR-006.
- Space is declared explicitly in a `LEN` const on each account struct, with the byte
  arithmetic written out as a comment. No `8 + std::mem::size_of::<T>()`.
- Use `checked_*` arithmetic everywhere. No `as` casts that can truncate. Promote to
  `u128` for any multiply of two `u64`s, and assert the documented bounds in `PLAN.md` §6.
- Errors: one `#[error_code]` enum per program, names ported 1:1 from the Solidity custom
  errors so existing docs and tests stay readable.
- Constraints over runtime checks. Prefer `has_one`, `seeds`, `bump`, `token::mint`,
  `token::authority` in the `#[derive(Accounts)]` context. A check that can be a
  constraint should be a constraint.
- Never accept an account you do not constrain. Never CPI to a program id passed in as
  data. Never trust `remaining_accounts` without validating each entry.
- Token programs: Token-2022 only for cUSDC/CT accounts; canonical legacy SPL Token for
  project token and USDC market/DAMM path in v1. Constrain exact program, mint, extensions,
  authorities and decimals; never infer them from a mutable Launch.
- `norr_claim`, `norr_fees`, `norr_market` and `norr_wrap` must be immutable before
  uncapped mainnet value. Do not merge a change that contradicts ADR-005.

### TypeScript

- `@solana/kit` for the client. Codama-generated clients from the Anchor IDLs — do not
  hand-write instruction encoders.
- All PDA derivation lives in one place (`packages/sdk/src/pda.ts`). No ad-hoc
  `findProgramAddressSync` calls in React components.
- Preserve the 19 route entries and all 41 component surfaces. `CreateLaunch` remains
  resumable; `PrivateVault` is visibly renamed Private workspace but keeps `/private`.
- The generated per-cluster deployment manifest is the only frontend address source.
  `Anchor.toml` is not a browser configuration file.
- Amounts are `bigint` end to end. Formatting happens at the render boundary only.

### Commits

- One phase deliverable per PR. A PR that touches a program and the UI that consumes it
  is fine; a PR that touches two programs is usually two PRs.
- Every program change re-generates the IDL and the Codama client in the same commit.

---

## 5. Commands

```bash
# validator with the feature set matched to mainnet (see PLAN.md §13)
./scripts/localnet.sh

anchor build
anchor test                      # integration, against localnet
cargo test-sbf                   # unit
pnpm --filter sdk test
pnpm --filter web dev            # http://localhost:5173

./scripts/e2e-local.sh           # full deploy -> seal -> tally -> claim -> withdraw
npx impeccable detect apps/web/src
npx impeccable detect http://localhost:5173
```

`impeccable detect` must return zero on both the static and the runtime scan. Findings
get fixed, never suppressed — the runtime scan catches what the static one cannot.

---

## 6. Hard rules for agents

- **Do not invent on-chain data.** If a figure is not returned by a program account or a
  CPI, it does not go on the surface. Inventing a placeholder violates invariant 2 and
  will be reverted.
- **Do not add a dependency to work around a Token-2022 gap.** Raise it instead; the gap
  is usually a design signal (see `PLAN.md` §15, issue I-11).
- **Do not pull V2 work into v1.** `PLAN.md` §19 is future scope. Research spikes are fine;
  no V2 dependency, account format or trust claim enters a v1 release without a new ADR.
- **Do not change the design tokens.** `DESIGN.md` is the contract. A retheme is a token
  edit in `tokens.css`, never a component rewrite — that property is why this codebase
  has survived three rethemes and it is worth protecting.
- **Do not make the program upgradeable-by-default and figure out governance later.**
  ADR-005 is a launch blocker, not a follow-up.
- **Do not make a human signer the owner of a Sale CT vault.** Sale PDA owns it.
- **Do not leave either Sale-vault credit flag enabled.** `contribute` is one atomic
  enable-transfer-disable gate; all other incoming transfers must fail.
- **Do not activate setup state.** Require locked untouched Router, fixed supply,
  revoked mint/freeze authorities, exact inventory, valid dates, stored destinations,
  metadata hash and liquidity lock.
- **Do not use raw vault balance as a reserve or liability.** Donations are bounded excess.
- **Do not read settlement destinations from mutable Launch.** Sale stores and validates
  wrapper, public mint, settlement vault and Router.
- **Do not use floor division for new curve reserves.** Use §6.1 `ceil_div`, then property
  test Rust and TypeScript at atom/max boundaries and 9/6 decimals.
- **Do not repeat the Merkle proof in `claim`.** `open_claim` domain-verifies it before
  account creation commits; claim uses stored allocation and canonical claimant ATA.
- **Do not send a DAMM position to a wallet at graduation.** Curve PDA owns it until the
  published >=180-day lock and routes position fees meanwhile.
- **Do not ship without the funded deadline-refund drill.** Missing proof-key liveness is a
  mainnet blocker, not a runbook TODO.
- **Do not log ciphertext, ElGamal keys, decrypted amounts or the tally map** anywhere
  that ships to a browser or a public log.
- **Do not commit a keypair, ElGamal/AES secret, decryptor key or `.env`.** The source
  contains a literal vault decryption key. Secret-scan history and artifacts; only named
  public local-validator fixtures may be allowlisted.
- **Never claim a deployment exists without verifying it.** The source repo's README once
  listed two mainnet addresses that returned `0x` for `eth_getCode`. Check
  `getAccountInfo` before writing an address into a doc or a UI.

---

## 7. Where things live

| Need | File |
|---|---|
| Full technical specification | `PLAN.md` |
| Architecture decisions + rationale | `PLAN.md` §3, including activation ADR-012 |
| Program account/instruction specs | `PLAN.md` §5 |
| Curve, split and Merkle math | `PLAN.md` §6 |
| Frontend port map | `PLAN.md` §9 |
| Design system + Solana accent | `DESIGN.md`, `tokens.css` |
| Known Solana-specific hazards | `PLAN.md` §15 |
| Parity checklist against the source repo | `PLAN.md` §16 |
| Final Q1-Q8 decisions | `PLAN.md` §17 |
| Privacy landscape / discarded alternatives | `PLAN.md` §18 |
| Post-v1 / V2 roadmap | `PLAN.md` §19 |
| The confidential/public boundary rule | `PLAN.md` §2 invariant 11 |
| The unwrap boundary (`settle`) | `PLAN.md` ADR-009 / Q8 |
| Confidential key derivation | `PLAN.md` ADR-010 |

If `PLAN.md` and this file disagree, `PLAN.md` wins on *what*, this file wins on *how*.
