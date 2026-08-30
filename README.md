# norr.fun — Solana Migration

A clean-room implementation of the coordination and token launch protocol specified in `PLAN.md`, featuring **private contribution and public settlement** on Solana.

---

## 1. What Norr Is & Why It Exists

Norr addresses the problem of market manipulation, front-running, and information leakage during capital formation:
- **Private Contribution:** Contributors commit funds to token sales with amount privacy using **SPL Token-2022 Confidential Transfers** (Twisted ElGamal encryption + zero-knowledge range/validity/equality proofs), keeping individual contribution sizes confidential while the raise is open.
- **Public Settlement:** Once the raise concludes, allocations are transparently settled into a constant-product bonding curve market (`norr-market`), fee routing distribution (`norr-fees`), and on-chain social coordination threads (`norr-social`).

---

## 2. Protocol Architecture

The protocol is composed of 7 modular Anchor program crates:

```text
[User Wallet]
     |
     |---> [norr-market: Bonding Curve Swap] ---> [norr-fees: Fee Router Split]
     |
     |---> [norr-social: Threads & Profiles]
     |
     |---> [norr-claim: Merkle Allocation Settlement]
     |
     +---> [norr-wrap: Confidential Transfer Adapter (Gated via P0 / ZK Proof Program)]
```

| Program | Program ID (Devnet Canonical) | Role |
| :--- | :--- | :--- |
| **`norr-launch`** | `BLGXWzLEVmABKedcTHcYoGGMm5ziG8WL7eRjfDnuMRnu` | Launch lifecycle, state transitions, and metadata |
| **`norr-market`** | `DWvsf7ZgXBMQy5BXgWkgRWbSwMzZgyeNoQL6kdiMmcMY` | Constant-product bonding curve ($k = \text{effective\_base} \times \text{token\_reserve}$) with fee routing |
| **`norr-fees`** | `8oc1FUKYsxmxuNxu5sMQXPQDS7LHPuTcQqHGeGysSRzY` | Basis-point fee accrual and order-independent recipient distribution |
| **`norr-boards`** | `67mL4D2ukz34urzrygPgTiLkiz7XYdWR4DJ6cYtfv2AJ` | Community desk curation and membership terms |
| **`norr-social`** | `Ae8w5UeyLrfe1RrzZue42hHeL1D7cohXDc1a6GfcPZos` | On-chain discussion threads, comments, profiles, follows, saves, and promotions |
| **`norr-claim`** | `68AW7FczGrPoeRfYUVeQnu6Aa55HnbgtMhVgRdTCwbSq` | Merkle allocation claims and emergency refunds (`P0Required` on private paths) |
| **`norr-wrap`** | `DxUhL7ncb43VA5neP3gX7pNVAghRv9FMsp1Ntz2T7a5i` | Confidential transfer wrapper (`P0Required` fail-closed) |

---

## 3. What Actually Works Today vs. Phase 3 Boundary

### Working & Verified Today
- **Public Core:** Full bonding curve buy/sell integer math with ceiling division and reserve product guarantees.
- **Fee Routing:** Exact basis-point fee accrual across creators, partner desks, and treasury.
- **Social & Desks:** On-chain threads, nested comments, profiles, follows, and community boards.
- **Settlement:** 20-depth capped Merkle tree claim/refund verification with domain separation.
- **Web Application:** Responsive 19-route React application with Solana wallet adapter integration.
- **Automated Tests:** 23 passing tests across SDK, CLI, indexer, tally, and root invariants.

### Phase 3 Confidential Status
Private contribution and confidential transfer execution are fail-closed behind `P0Required` because canonical Token-2022 cluster support required by the protocol is currently unavailable. The repository contains real Devnet evidence for the completed confidential setup/proof/deposit/apply stages and does not substitute a mock ledger.

- **Real Devnet Evidence (Steps 1–5):**
  - Confidential Mint: `6RBs6aoEpQZ59aKfpqWE2SnAX3cysBo3whFuhBoe9suT` (Tx: `hcdG2LHttVqiRHsA4c3wAZneNazx9Vcv8HMFdcGWYrVSDj5QXLzj2LuckTogY7wDoHusXzCxCMbuf9McEgUTgS9`)
  - Confidential Account (469B): `HKrZcotGz9MCJz1yLzBq4Cd6mYFViNb8iCgtY3gTRSMm` (Tx: `3b7sDbLKjAS18Wg9pC1TWCtpDDpWQFYwHFi3F7AeQFt1xsbowghbBekQLDy7YD3jbh6NyJAS2Cjqq85ceXWBqqmQ`)
  - ZK Proof Context Accounts on `ZkE1Gama1Proof...`: Eq Proof (`9XD9og...`), Val Proof (`DEMU2U...`), Range Proof (`2sv7fj...`)
  - Confidential Deposit ($50,000): Tx `3P2SdAFiifSFve3Vope6dVEb1bNjxyrXbhNaBpJ5AYiv1rm1XHRPB2KxPxSpzioPSHgqeuDkt6odQsBndrp1cf3c`
  - Apply Pending Balance: Verified decrypted available balance = $50,000.
- **Step 6 Blocker:** `ConfidentialTransferInstruction::Transfer` returns `InvalidInstructionData` because the deployed Core BPF Token-2022 program at `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` has `feature = "zk-ops"` compiled out.

---

## 4. How to Run Locally

### Prerequisites
- Node.js `22.x` (or `20.x` LTS)
- `pnpm` 10+
- Python 3.10+ (for secret scanning)

### Installation & Build
```bash
# Install dependencies
pnpm install

# Build all packages and web production bundle
pnpm -r build

# Run automated tests
pnpm -r test
node --import tsx --test tests/invariants.test.ts

# Run secret scan
python scripts/secret-scan.py

# Launch Web Application
pnpm --filter @norr/web dev
```

The web application will be accessible at `http://localhost:5173`.

---

## 5. Web App Deployment

For complete instructions on deploying the web application to Vercel, Netlify, Cloudflare Pages, or AWS S3, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## 6. Audit & Status Documentation

- [`SUBMISSION_STATUS.md`](SUBMISSION_STATUS.md): Complete residency submission status, deployed program IDs, and 60-second reviewer demo path.
- [`docs/final-project-audit.md`](docs/final-project-audit.md): Full component-by-component audit against `PLAN.md`.
- [`docs/p0-phase3-audit.md`](docs/p0-phase3-audit.md): Cryptographic & Devnet on-chain proof account breakdown.
- [`docs/p0-phase3-blocked.md`](docs/p0-phase3-blocked.md): Upstream Token-2022 runtime log and dependency analysis.
- [`AGENT_HANDOFF.md`](AGENT_HANDOFF.md): Engineering handoff log and invariant rules.
