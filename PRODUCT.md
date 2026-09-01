# Norr — Product Specification

**Private contribution. Public settlement.**

Norr is a capital formation and trading protocol built natively on Solana. It enables founders to raise funds with confidential contribution amounts using Token-2022 and zero-knowledge ElGamal proofs, followed by deterministic on-chain settlement and autonomous secondary markets.

---

## 1. The Problem

Public token launches on transparent blockchains suffer from structural vulnerabilities:
1. **Front-Running & Sniping**: Public transaction amounts allow MEV bots and whales to observe capital allocations before a round closes.
2. **Social Proof Coercion & Panic**: Transparent balances create herd dynamics, where contributors wait for lead orders or panic when large capital moves.
3. **Information Asymmetry**: Whales track contributor wallet flows, compromising individual capital privacy.
4. **Opaque & Discretionary Settlement**: Traditional off-chain raises rely on centralized entities to calculate allocations and distribute tokens, introducing counterparty and custodial risks.

---

## 2. The Solution: Norr Protocol

Norr solves capital privacy and settlement transparency through a hybrid cryptographic model:
- **Private Contribution**: Contributor balances and contribution amounts are encrypted under Token-2022 Twisted ElGamal ciphertexts with ZK range and validity proofs.
- **Auditor Model**: A designated audit authority holds a viewing key to decrypt amounts solely for verifiable balance aggregation during tallying, without possessing spending authority.
- **Public Deterministic Settlement**: Tally manifests commit an immutable double-keccak256 Merkle root to the `norr-claim` program on-chain.
- **Permissionless Claims**: Contributors generate cryptographic proofs in-browser and claim their project tokens directly from the audited on-chain vault.
- **Autonomous Secondary Market**: Upon graduation, project tokens trade on an autonomous constant-product bonding curve against USDC (`norr-market`).
- **Curator Desks & Fee Routing**: Decentralized curation boards (`norr-boards`) lock revenue splits that automatically stream protocol fees to creators and curators (`norr-fees`).

---

## 3. Target Users

- **Founders & Creators**: Launch tokens with sealed, fair-price discovery, automated fee splits, and instant liquidity upon graduation.
- **Contributors**: Participate in early-stage capital formation without broadcasting investment size or wallet exposure.
- **Curators & Community Leads**: Open curated desks, back launches, and receive transparent on-chain fee distributions.
- **Traders**: Trade fixed-supply project tokens with mathematical curve pricing and transparent liquidity reserves.

---

## 4. Core Protocol Features

### A. Sealed Raise
- **Encrypted Capital Allocation**: Zero on-chain amounts leaked while the sale is accepting contributions.
- **ZK Verification**: Every balance update requires on-chain zero-knowledge equality, validity (3-handles), and 128-bit range proofs verified by Solana's native ZK ElGamal proof program.
- **Fail-Closed Settlement**: If a raise fails to finalize before the deadline or enters emergency status, contributors execute on-chain disaster refunds via `commit_refund`.

### B. Instant Market & Bonding Curve
- **Autonomous Pricing**: Virtual base reserves (`x * y = k`) ensure instant opening liquidity with predictable price slippage.
- **Exact Integer Arithmetic**: Fixed-point Q64 calculations prevent rounding drift or reserve drainage.
- **Fee Routing**: Trade fees are split proportionally between creator, curation desk, and protocol treasury.

### C. Community Curation & Social Desk
- **Immutable Revenue Share**: Curators define a minimum basis-point share snapshotted at attach time.
- **On-Chain Discussions**: Cryptographically authenticated threads and comments via `norr-social`.

---

## 5. Live Devnet State

All 7 Norr Anchor programs are deployed and executable on Solana Devnet:
- `norr-launch`: `4orq3YjidamefZgGufp6uSpdgxdxpNeCfdy6spZas2cE`
- `norr-claim`: `HzV76HzGKqDuhmc2f5VoMDEF3tqo3GYGbMGbYyRYWitg`
- `norr-fees`: `3VNFr1kkLv1mQkpWQSNBJhDJbpLsELPPF7f5YMWHjMy8`
- `norr-market`: `3syw2wKJNu1TCGArkvnZHvJ8xN9mn5oHdr34yrpJdyXB`
- `norr-boards`: `7EtFrHpKzvKYYWYNqimJu8t4UEmDgxTvwyqnGhcuAenB`
- `norr-social`: `4BNL4GDkUFkCdVZTXo9e3KYRDsD32DXdcrTYJXiucs7g`
- `norr-wrap`: `6anK695vF91cd3r2iin9AMRQzWCfJL6sugZywdfj9cdV`

Live web application: [https://norr-nine.vercel.app/](https://norr-nine.vercel.app/)
