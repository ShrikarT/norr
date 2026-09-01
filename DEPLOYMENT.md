# Norr Protocol — Deployment & Operations Guide

This guide details how to build, deploy, and verify the Norr protocol on-chain programs and web application across Solana Devnet and Mainnet environments.

---

## 1. Prerequisites & Tooling

Ensure the following tools are installed in your deployment environment:
- **Rust**: `1.79.0` (or `1.81.0`) via `rustup`
- **Solana CLI**: `>= 1.18.0` (e.g. `solana-cli 1.18.26` / `2.1.0`)
- **Anchor CLI**: `0.30.1` (`cargo install --git https://github.com/coral-xyz/anchor avm --locked && avm install 0.30.1`)
- **Node.js**: `>= 20.0.0` (LTS)
- **pnpm**: `>= 9.0.0` (e.g. `pnpm v10.x`)

---

## 2. On-Chain Program Deployment

Norr comprises 7 Anchor programs deployed under the BPF Upgradeable Loader.

### A. Build SBF Bytecode
```bash
# Build all 7 programs with Anchor
anchor build

# Verify build artifacts
ls -la target/deploy/*.so
```

### B. Configure Target Cluster & Deployer Keypair
```bash
# Set cluster target (Devnet or Mainnet)
solana config set --url https://api.devnet.solana.com

# Verify deployer wallet balance (minimum ~12 SOL required for rent exemption)
solana balance
```

### C. Deploy Programs
```bash
# Execute deployment script
bash scripts/deploy-programs.sh
```

### D. Verify Deployment on RPC
```bash
# Run the live RPC verification probe
pnpm exec tsx scripts/check-programs.ts
```

| Program | Devnet Address | Slot |
| :--- | :--- | :--- |
| `norr-launch` | `4orq3YjidamefZgGufp6uSpdgxdxpNeCfdy6spZas2cE` | 491042546 |
| `norr-claim` | `HzV76HzGKqDuhmc2f5VoMDEF3tqo3GYGbMGbYyRYWitg` | 491042655 |
| `norr-fees` | `3VNFr1kkLv1mQkpWQSNBJhDJbpLsELPPF7f5YMWHjMy8` | 491042754 |
| `norr-market` | `3syw2wKJNu1TCGArkvnZHvJ8xN9mn5oHdr34yrpJdyXB` | 491042864 |
| `norr-boards` | `7EtFrHpKzvKYYWYNqimJu8t4UEmDgxTvwyqnGhcuAenB` | 491042908 |
| `norr-social` | `4BNL4GDkUFkCdVZTXo9e3KYRDsD32DXdcrTYJXiucs7g` | 491043022 |
| `norr-wrap` | `6anK695vF91cd3r2iin9AMRQzWCfJL6sugZywdfj9cdV` | 491043126 |

---

## 3. Web Application Deployment

### Build Specifications
| Setting | Value |
| :--- | :--- |
| **Framework** | Vite + React (SPA) |
| **Package Manager** | `pnpm` |
| **Root Directory** | `.` (repository root) |
| **Build Command** | `pnpm --filter @norr/web build` |
| **Output Directory** | `apps/web/dist` |

### Environment Variables
| Variable | Required | Default / Recommended Value | Description |
| :--- | :--- | :--- | :--- |
| **`VITE_SOLANA_RPC_URL`** | Optional | `https://api.devnet.solana.com` | Target Solana RPC endpoint |
| **`VITE_INDEXER_URL`** | Optional | `http://127.0.0.1:8787` | Hosted history indexer endpoint |

---

## 4. Hosting Platform Configuration

### Deploying to Vercel
1. Import repository on [Vercel](https://vercel.com).
2. Set **Framework Preset** to `Vite`.
3. Set **Root Directory** to `.` (or `apps/web`).
4. Set **Build Command** to `pnpm --filter @norr/web build`.
5. Set **Output Directory** to `apps/web/dist`.
6. Add `VITE_SOLANA_RPC_URL=https://api.devnet.solana.com`.
7. Click **Deploy**.

---

## 5. Post-Deployment Verification Checklist

- [x] Open deployment URL: [https://norr-nine.vercel.app/](https://norr-nine.vercel.app/)
- [x] Verify `/` connects to Devnet RPC and displays cluster slot and active programs.
- [x] Verify `/desks` renders live curation desks with on-chain creation.
- [x] Verify `/start` enables launch creation with wallet signing.
- [x] Verify `/private` displays live Token-2022 proof context accounts and active P0 gate.
