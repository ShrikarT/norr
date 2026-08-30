# Norr — Product & Technical Status

## 1. What Norr Is

**Norr** is a Solana-native coordination and token launch protocol featuring **private contribution and public settlement**:
- **Contribution Phase:** Allows users to contribute to token raises with amount privacy using **SPL Token-2022 Confidential Transfers** (Twisted ElGamal encryption + zero-knowledge range/validity/equality proofs), keeping individual contribution sizes private while the sale is open.
- **Settlement & Trading Phase:** Transparently settles token allocations via deterministic Merkle trees into a public bonding curve market (`norr-market`), fee routing distribution (`norr-fees`), and social coordination threads (`norr-social`).

Norr follows a strict **fail-closed architecture**: if cryptographic or on-chain capabilities are not proven on the target cluster, the protocol safely locks down private value movement rather than falling back to an unverified custom ledger.

---

## 2. Architecture & Program Overview

The protocol consists of 7 modular Anchor programs on Solana. The IDs below are declared canonical IDs; they are **not yet deployed** to a public cluster, and the app verifies this live rather than assuming it:

```text
User Wallet
     |
     |---> [norr-market: Bonding Curve Swap] ---> [norr-fees: Fee Router Split]
     |
     |---> [norr-social: Threads & Profiles]
     |
     |---> [norr-claim: Merkle Allocation Settlement]
     |
     +---> [norr-wrap: Confidential Transfer Adapter (Gated via P0 / ZK Proof Program)]
```

| Program | Program ID (declared; not yet deployed — probed live by the app) | Role |
| :--- | :--- | :--- |
| **`norr-launch`** | `4cpxPRvPm974bLKMJa8TfYyvzuFeQ9sjtFJkz3EhJ4p8` | Launch initialization, parameters, and metadata |
| **`norr-market`** | `Gx4szwkK1wMYpyZJ6y168ytuPNfC3gq9kehg3XjgMNkV` | Constant-product bonding curve buy/sell trading with exact fee routing |
| **`norr-fees`** | `6qXW6K7UxDmzxotm8XM5uqWiqF6hBokMdkGavbw5Mp6J` | Pro-rata basis-point fee accrual and recipient release distribution |
| **`norr-boards`** | `2CfmqDruJHpAqManNjNAfEhCX99NhBAkmCQ73Tt5FXvY` | Community desk curation and membership terms |
| **`norr-social`** | `95naDaDALhhL37JseHMkJFeUqPs8ucNYcaSwZCknScAw` | On-chain threads, comments, profiles, follows, saves, and promotions |
| **`norr-claim`** | `4QrYBhxu8crT4Yi33XR6DqQEp1XG52R94rBzgx8QdF9R` | Merkle claim distribution, emergency refunds (`P0Required` on private paths) |
| **`norr-wrap`** | `9qLPCBzMENxbTVvFQCACtfD9DnY1KBhz3WFqMzc8u7LU` | Confidential transfer wrapper (`P0Required` fail-closed) |

---

## 3. Real Devnet Execution Evidence

The protocol was executed and verified against **Solana Devnet** (`https://api.devnet.solana.com`, Genesis Hash: `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`):

| Operation | Devnet Signature / Evidence | On-Chain Status |
| :--- | :--- | :--- |
| **Confidential Mint Creation** | `hcdG2LHttVqiRHsA4c3wAZneNazx9Vcv8HMFdcGWYrVSDj5QXLzj2LuckTogY7wDoHusXzCxCMbuf9McEgUTgS9` | Confirmed (Mint: `6RBs6aoEpQZ59aKfpqWE2SnAX3cysBo3whFuhBoe9suT`) |
| **Confidential Account Config** | `3b7sDbLKjAS18Wg9pC1TWCtpDDpWQFYwHFi3F7AeQFt1xsbowghbBekQLDy7YD3jbh6NyJAS2Cjqq85ceXWBqqmQ` | Confirmed (Account: `HKrZcotGz9MCJz1yLzBq4Cd6mYFViNb8iCgtY3gTRSMm`, 469B) |
| **ZK Proof Context Accounts** | * Eq Proof (Disc 3): `5WkpLNaDqCRKPn5NV8AShSUxT7enoa6UgECsiL66aK4RYLB1eqkysCJFJYxqYuXCeLuxTkCPafLj1W3LaiYaDanT`<br>* Val Proof (Disc 12): `2m1DRUEfvpwL4xvdt9vmpJM4SsrexMfezisaYLo9sho8bMkshB6bPRysWRPjgQtjgKqqBXz731fVC8AL47DgDci2`<br>* Range Proof (Disc 7): `65oGEiFoTrz3HJmNnVbu11ndskT8d3k6YBanAfabXibwrVXFGxFGcSMkDMiR5Z2ac61AsgfnezpTmQ7A6govBjFQ` | Confirmed on `ZkE1Gama1Proof11111111111111111111111111111` |
| **Confidential Deposit** | `3P2SdAFiifSFve3Vope6dVEb1bNjxyrXbhNaBpJ5AYiv1rm1XHRPB2KxPxSpzioPSHgqeuDkt6odQsBndrp1cf3c` | Confirmed ($50,000 deposited to pending balance) |
| **Apply Pending Balance** | Verified on-chain via AE key: credit counter incremented, available balance decrypted to **$50,000**. | Confirmed |

---

## 4. Confidential Capability Boundary & Upstream Dependency

### Current Status: Fail-Closed
When executing `ConfidentialTransferInstruction::Transfer`, the transaction simulation fails on Devnet with:
```text
Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]
Program log: ConfidentialTransferInstruction::Transfer
Program log: Error: InvalidInstructionData
Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb consumed 1914 of 200000 compute units
Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb failed: invalid instruction data
```

### Upstream Root Cause
In official SPL Token-2022 (`spl-token-2022/src/extension/confidential_transfer/processor.rs`):
```rust
ConfidentialTransferInstruction::Transfer => {
    msg!("ConfidentialTransferInstruction::Transfer");
    #[cfg(feature = "zk-ops")]
    {
        let data = decode_instruction_data::<TransferInstructionData>(input)?;
        process_transfer(...)
    }
    #[cfg(not(feature = "zk-ops"))]
    Err(ProgramError::InvalidInstructionData)
}
```
The canonical Core BPF binary deployed at `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` across all public Solana clusters (Devnet, Testnet, Mainnet-Beta) was compiled **without** `feature = "zk-ops"`.

### Security Decisions:
1. **No Simulated Bypass:** We do not mock balance transfers or forge execution reports.
2. **Fail-Closed Gate:** `P0Required` remains strictly active in `programs/norr-claim` and `programs/norr-wrap`.

---

## 5. How to Run Locally

### Prerequisites
- Node.js `22.x`
- `pnpm` 10+
- Python 3.10+ (for secret scanning)

### Quick Start
```bash
# 1. Install dependencies
pnpm install

# 2. Build entire workspace (packages + apps + web production bundle)
pnpm -r build

# 3. Run automated tests (23 tests across sdk, confidential, indexer, tally, cli, invariants)
pnpm -r test
node --import tsx --test tests/invariants.test.ts

# 4. Run repository secret scan
python scripts/secret-scan.py

# 5. Launch the Web App
pnpm --filter @norr/web dev
```

The web application will be accessible at `http://localhost:5173`.

---

## 6. 60-Second Reviewer Demo Path

1. **Launch the Web App:** Run `pnpm --filter @norr/web dev` and open `http://localhost:5173`.
2. **Understand the Protocol (0:00–0:15):** The sidebar prominently highlights the core philosophy: *"Private contribution. Public settlement."* Topbar shows live cluster status and Solana wallet integration.
3. **Explore Public Market & Desks (0:15–0:30):** Navigate to **Feed (`/`)** and **Desks (`/desks`)** to see live raises, curated community boards, and constant-product bonding curve pricing.
4. **Inspect the Private Workspace (0:30–0:45):** Navigate to **Private (`/private`)**. Observe the transparent capability gate:
   - Status badge shows: **`BLOCKED`**.
   - Explicit notification: *"No P0 report matches this cluster. Wrap, apply, transfer, withdraw, and unwrap remain disabled. There is no fallback ledger."*
5. **Verify Devnet Evidence (0:45–1:00):** Inspect `docs/p0-phase3-audit.md` to review the genuine Devnet transaction signatures and on-chain ZK proof context accounts.

---

## 7. Next Steps

- **Confidential Transfer Execution:** Blocked upstream on Solana clusters pending canonical Token-2022 `zk-ops` activation.
- **Immediate Resumption:** Once Solana Foundation / Anza enables `zk-ops` on Devnet, confidential transfers can be immediately executed on-chain.
