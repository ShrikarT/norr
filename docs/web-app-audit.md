# Norr Web Application Interactive Surface Audit

Audit of all routes, features, interactive buttons, and backend connections in `apps/web`:

| Route | Feature / Component | Backend / Program | Real Transaction? | Current Status | Notes / Blocked Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Live Feed & Metrics | RPC / `apps/indexer` | Read-only | **LIVE / REAL** | Queries Devnet slot, genesis hash, indexer health, and on-chain launches. |
| `/raise/:sale` | Launch Detail Overview | `programs/norr-launch` | Read-only | **LIVE / REAL** | Displays launch metadata, bonding curve metrics, and revenue splits. |
| `/raise/:sale` | Bonding Curve Market (Buy/Sell) | `programs/norr-market` | **YES** | **INTERACTIVE / REAL** | Real-time integer quote math, DAG tx simulation on Devnet, wallet signing & confirmation. |
| `/raise/:sale` | Discussion & Comments | `programs/norr-social` | **YES** | **INTERACTIVE / REAL** | Submits on-chain comment post transaction via Anchor `norr-social` instruction. |
| `/raise/:sale` | Allocation Merkle Claim | `programs/norr-claim` | **YES** | **INTERACTIVE / REAL** | Verifies 20-depth Merkle proof against on-chain root and submits public claim transaction. |
| `/start` | Launch Model Selection | Frontend Router | N/A | **LIVE / REAL** | Routes to instant market launch or sealed raise setup. |
| `/start/instant` | Instant Launch Creator | `programs/norr-launch` | **YES** | **INTERACTIVE / REAL** | Validates metadata URI, supply, builds `createLaunch` transaction, simulates and submits. |
| `/desks` | Curated Desks Feed | `programs/norr-boards` | Read-only | **LIVE / REAL** | Displays community desks with minimum fee share BPS terms. |
| `/desks` | Open a Desk | `programs/norr-boards` | **YES** | **INTERACTIVE / REAL** | Creates a new curator desk PDA with custom slug and minimum share BPS. |
| `/desk/:slug` | Desk Detail & Follow | `programs/norr-boards` / `norr-social` | **YES** | **INTERACTIVE / REAL** | Displays attached raises; "Follow Desk" creates on-chain follow record. |
| `/owed` | Fee Router & Release | `programs/norr-fees` | **YES** | **INTERACTIVE / REAL** | Inspects recipient entitlement and submits `release` transaction on Devnet. |
| `/activity` | Indexer Activity Stream | `apps/indexer` | Read-only | **LIVE / REAL** | Connects to indexer REST API `/v1/activity`; shows clean empty state if no events. |
| `/portfolio` | User Portfolio & Balances | Solana Devnet RPC | Read-only | **LIVE / REAL** | Queries connected wallet Devnet SOL balance and token accounts directly from RPC. |
| `/compare` | Comparative Metrics | Solana Devnet RPC | Read-only | **LIVE / REAL** | Table comparison of verified on-chain launch parameters and curve prices. |
| `/private` | Private Workspace & CT | `programs/norr-wrap` | Gated | **FAIL-CLOSED (GATED)** | Blocked by upstream Token-2022 `zk-ops` compilation boundary. Displays real Devnet proof evidence. |
| `/raise/:sale` | Sealed Contribution | `programs/norr-claim` | Gated | **FAIL-CLOSED (GATED)** | `P0Required` fail-closed gate. Shows exact upstream capability disclosure. |
| `/settings` | Density & RPC Settings | Local Storage / RPC | N/A | **LIVE / REAL** | Configures UI density and displays verified Devnet RPC genesis hash. |
