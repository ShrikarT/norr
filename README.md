# Norr

**Private contribution. Public settlement.**

Norr is a Solana-native coordination and token launch protocol designed for private capital formation, transparent settlement, and community-driven markets.

---

## What is Norr?

Norr provides a dual-phase capital formation and trading framework on Solana:
1. **Private Contribution Phase:** Contributors commit funds to token sales with amount privacy using **SPL Token-2022 Confidential Transfers** (Twisted ElGamal encryption + zero-knowledge range/validity/equality proofs). Individual contribution sizes remain private while the raise is open.
2. **Public Settlement & Trading Phase:** Once a raise completes, allocations are deterministically settled into a constant-product bonding curve market (`norr-market`), fee routing distribution (`norr-fees`), and on-chain social coordination threads (`norr-social`).

---

## Why Norr?

Traditional on-chain capital formation suffers from acute information leakage and coordination friction:
- **Information Leakage & Front-Running:** Public contribution amounts allow MEV bots and large participants to copy-trade, snipe, or front-run allocations.
- **Contribution-Size Signaling:** Public wallet balances and contribution sizes reveal trading intent before market price discovery begins.
- **Fragmented Post-Sale Liquidity:** Many launchpads decouple the raise from secondary trading, requiring manual liquidity deployment. Norr automates settlement directly into on-chain bonding curves and fee-sharing routers.

---

## Product Surfaces & Features

- **Token Launches (`/start`, `/:cluster/raise/:sale`):** Create instant bonding curve launches or private capital raises with fixed project supply and transparent vesting terms.
- **Private Contribution (`/private`):** Amount-private contributions using native SPL Token-2022 confidential transfer extensions.
- **Bonding Curve Markets (`/`, `/:cluster/raise/:sale`):** Autonomous continuous liquidity pools executing constant-product arithmetic with exact fee distribution.
- **Community Desks (`/desks`, `/desk/:slug`):** Curated creator desks with minimum fee share terms and attach limits.
- **On-Chain Social Coordination (`norr-social`):** Discussion threads, nested comments, profile accounts, follows, saves, and promotion tiers anchored directly on-chain.
- **Fee Routing (`/owed`):** Basis-point fee splitting and distribution to creators, desks, and protocol treasuries.
- **Deterministic Claims (`norr-claim`):** 20-depth capped Merkle tree claim distribution and emergency refund escrows.

---

## Architecture

```text
User Wallet
    |
    +---> Launches (norr-launch)
    |
    +---> Private Contributions (Token-2022 CT / norr-wrap)
    |
    +---> Public Settlement (norr-claim)
    |
    +---> Bonding Curve Market (norr-market)
    |
    +---> Fee Routing Distribution (norr-fees)
    |
    +---> Community Desks (norr-boards)
    |
    +---> Social Coordination (norr-social)
```

---

## Solana Programs

The protocol consists of 7 modular Anchor programs. **Deployment status:** the program IDs below are the declared canonical IDs; they are **not yet deployed** to a public cluster. The web app probes each ID against the connected RPC and only enables write actions when a program is actually executable — nothing assumes deployment.

| Program | Program ID (declared; deployment probed live by the app) | Role |
| :--- | :--- | :--- |
| **`norr-launch`** | `4cpxPRvPm974bLKMJa8TfYyvzuFeQ9sjtFJkz3EhJ4p8` | Launch parameters, lifecycle states, and metadata |
| **`norr-market`** | `Gx4szwkK1wMYpyZJ6y168ytuPNfC3gq9kehg3XjgMNkV` | Constant-product bonding curve ($k = \text{effective\_base} \times \text{token\_reserve}$) with fee routing |
| **`norr-fees`** | `6qXW6K7UxDmzxotm8XM5uqWiqF6hBokMdkGavbw5Mp6J` | Basis-point fee accrual and order-independent recipient distribution |
| **`norr-boards`** | `2CfmqDruJHpAqManNjNAfEhCX99NhBAkmCQ73Tt5FXvY` | Curated community desks and membership terms |
| **`norr-social`** | `95naDaDALhhL37JseHMkJFeUqPs8ucNYcaSwZCknScAw` | Discussion threads, comments, user profiles, follows, and promotions |
| **`norr-claim`** | `4QrYBhxu8crT4Yi33XR6DqQEp1XG52R94rBzgx8QdF9R` | Merkle claim distribution and refund escrows (`P0Required` on private paths) |
| **`norr-wrap`** | `9qLPCBzMENxbTVvFQCACtfD9DnY1KBhz3WFqMzc8u7LU` | Confidential token adapter (`P0Required` fail-closed) |

---

## What's Real & Verified

### Working Public Systems
- **Bonding Curve Arithmetic:** Exact integer pricing math, ceiling division (`ceilDiv`), and reserve product invariant preservation.
- **Pro-Rata Fee Distribution:** Accrual delta accounting with non-repayable donation surplus isolation.
- **On-Chain Social & Desks:** Full thread indexing, comment hierarchies, marker accounts, and desk curation.
- **Merkle Settlement:** Domain-separated leaf verification for claim allocations and refund escrows.
- **Frontend Application:** 13-route React single-page application with live Solana wallet connection, live genesis-hash cluster verification, and live per-program deployment probing. No fake success paths: every write simulates first and only reports what the cluster confirms.
- **Automated Test Suite:** 22 passing tests covering unit, property, and invariant behaviors.

### Real Devnet Verification Evidence
- **Confidential Mint:** `6RBs6aoEpQZ59aKfpqWE2SnAX3cysBo3whFuhBoe9suT` (Tx: `hcdG2LHttVqiRHsA4c3wAZneNazx9Vcv8HMFdcGWYrVSDj5QXLzj2LuckTogY7wDoHusXzCxCMbuf9McEgUTgS9`)
- **Confidential Account (469B):** `HKrZcotGz9MCJz1yLzBq4Cd6mYFViNb8iCgtY3gTRSMm` (Tx: `3b7sDbLKjAS18Wg9pC1TWCtpDDpWQFYwHFi3F7AeQFt1xsbowghbBekQLDy7YD3jbh6NyJAS2Cjqq85ceXWBqqmQ`)
- **ZK Proof Context Accounts on `ZkE1Gama1Proof11111111111111111111111111111`:**
  - Equality Proof (Disc 3): `9XD9og7ZUCsQNrxjGfTnhndha2eNF4gsGPrNqY8RhAfc`
  - 3-Handles Validity Proof (Disc 12): `DEMU2UL3CWpkg9b1M9UktKeuPj9tr5d4QPnoGp1q6QHr`
  - 128-Bit Range Proof (Disc 7): `2sv7fjxXD4YtEu4KeVknL8wUuKTXXgBovXm342qCHmJY`
- **Confidential Deposit ($50,000):** Tx `3P2SdAFiifSFve3Vope6dVEb1bNjxyrXbhNaBpJ5AYiv1rm1XHRPB2KxPxSpzioPSHgqeuDkt6odQsBndrp1cf3c`
- **Apply Pending Balance:** Decrypted available balance confirmed on-chain at **$50,000**.

---

## Security Model & Fail-Closed Invariants

Norr operates on a strict fail-closed security posture:
- **No Mock Ledgers:** If cryptographic or runtime operations are unverified or unsupported on a target cluster, the protocol safely refuses value-moving operations.
- **`P0Required` Invariant:** `norr-claim` and `norr-wrap` strictly gate confidential contribution and withdrawal endpoints behind a verified on-chain execution report.

---

## Current Limitations & Capability Boundary

Private contribution and confidential transfer execution are currently fail-closed behind `P0Required` because canonical Token-2022 cluster support required by the protocol is currently unavailable on the target network.

The deployed Core BPF Token-2022 program at `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` across public Solana clusters (Devnet, Testnet, Mainnet-Beta) was compiled without the `zk-ops` execution feature, causing `ConfidentialTransferInstruction::Transfer` to return `InvalidInstructionData`. The repository contains real Devnet evidence for all prerequisite confidential setup, proof generation, context account creation, deposit, and apply stages, and safely halts at the transfer execution boundary.

---

## How to Run Locally

### Prerequisites
- Node.js `22.x` (or `20.x` LTS)
- `pnpm` 10+
- Python 3.10+ (for secret scanning)

### Commands
```bash
# 1. Install dependencies
pnpm install

# 2. Build workspace & web production bundle
pnpm -r build

# 3. Run automated tests (23 tests)
pnpm -r test
node --import tsx --test tests/invariants.test.ts

# 4. Run secret scan
python scripts/secret-scan.py

# 5. Start the web app locally
pnpm --filter @norr/web dev
```

Visit `http://localhost:5173` to explore the user interface.

---

## Deployment

To deploy the web application to Vercel, Netlify, Cloudflare Pages, or AWS S3, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Documentation Index

- [`DEPLOYMENT.md`](DEPLOYMENT.md): Frontend production build and static hosting guide.
- [`docs/p0-phase3-audit.md`](docs/p0-phase3-audit.md): Cryptographic and Devnet on-chain proof account breakdown.
- [`docs/p0-phase3-blocked.md`](docs/p0-phase3-blocked.md): Upstream Token-2022 runtime log and dependency analysis.
- [`docs/confidential-transfers.md`](docs/confidential-transfers.md): Privacy boundary and fail-closed gate design.
- [`docs/indexing.md`](docs/indexing.md): Rebuildable history indexing model.
- [`docs/norr-demo-script.md`](docs/norr-demo-script.md): Demo video script and timing map.

## Demo

`norr-demo.mp4` (repo root, ~2 minutes) walks the product, the live Devnet evidence, and the honestly gated confidential transfer boundary. Thumbnail: `norr-demo-thumbnail.png`.

## Roadmap

1. Deploy the seven Anchor programs to Devnet with verified builds and published IDLs.
2. Resume the confidential pipeline the moment upstream Token-2022 ships with zk-ops enabled — zero architecture changes required.
3. Complete the P0 acceptance drills on the target cluster and unlock `P0Required` paths.
4. Locked-liquidity graduation, indexer-backed history, and the desk curation economy.
5. Immutability handover for `norr-claim`, `norr-fees`, `norr-market`, `norr-wrap` before uncapped mainnet value.
