# Norr Protocol — Devnet Audit Evidence & Transaction Log

This document records the verifiable on-chain evidence, transaction signatures, and state accounts for the Norr protocol on Solana Devnet (`https://api.devnet.solana.com`).

---

## 1. Deployed On-Chain Programs

| Program | Devnet Address | Executable | Deployment Slot | Upgrade Authority |
| :--- | :--- | :---: | :---: | :--- |
| `norr-launch` | `4orq3YjidamefZgGufp6uSpdgxdxpNeCfdy6spZas2cE` | **true** | `491042546` | `BPFLoaderUpgradeab1e11111111111111111111111` |
| `norr-claim` | `HzV76HzGKqDuhmc2f5VoMDEF3tqo3GYGbMGbYyRYWitg` | **true** | `491042655` | `BPFLoaderUpgradeab1e11111111111111111111111` |
| `norr-fees` | `3VNFr1kkLv1mQkpWQSNBJhDJbpLsELPPF7f5YMWHjMy8` | **true** | `491042754` | `BPFLoaderUpgradeab1e11111111111111111111111` |
| `norr-market` | `3syw2wKJNu1TCGArkvnZHvJ8xN9mn5oHdr34yrpJdyXB` | **true** | `491042864` | `BPFLoaderUpgradeab1e11111111111111111111111` |
| `norr-boards` | `7EtFrHpKzvKYYWYNqimJu8t4UEmDgxTvwyqnGhcuAenB` | **true** | `491042908` | `BPFLoaderUpgradeab1e11111111111111111111111` |
| `norr-social` | `4BNL4GDkUFkCdVZTXo9e3KYRDsD32DXdcrTYJXiucs7g` | **true** | `491043022` | `BPFLoaderUpgradeab1e11111111111111111111111` |
| `norr-wrap` | `6anK695vF91cd3r2iin9AMRQzWCfJL6sugZywdfj9cdV` | **true** | `491043126` | `BPFLoaderUpgradeab1e11111111111111111111111` |

---

## 2. Token-2022 Confidential Transfer Lifecycle (Steps 1–8)

| Step | Operation | Devnet Signature / Account Address | Status |
| :--- | :--- | :--- | :--- |
| **Step 1** | Auditor-Enabled Mint | [`9E2w3wPkKnQHcsrmAEtTCh7XQzUEJ8dmEpyWtzauMW1Z`](https://explorer.solana.com/address/9E2w3wPkKnQHcsrmAEtTCh7XQzUEJ8dmEpyWtzauMW1Z?cluster=devnet) | **DEVNET VERIFIED** |
| **Step 2** | Source CT Account | [`3N8KkTcAquDZkMvNu5cPKfJ6b1k6DEVfVEh2j8jT6puY`](https://explorer.solana.com/address/3N8KkTcAquDZkMvNu5cPKfJ6b1k6DEVfVEh2j8jT6puY?cluster=devnet) | **DEVNET VERIFIED** |
| **Step 2** | Destination CT Account | [`NXuNZjWtnC4xYaHBx4ooPLhfP2vZyrEMewQhJecSxPM`](https://explorer.solana.com/address/NXuNZjWtnC4xYaHBx4ooPLhfP2vZyrEMewQhJecSxPM?cluster=devnet) | **DEVNET VERIFIED** |
| **Step 3** | Equality Proof Context | [`5U3cb5iEeKG7j2b8JuEyzP5BRhq9NiN29m7zGEzGK1aiSxWSWcT3G2XJwZ9Rj5dFYkFRZfUoWjXUJHhySnS6my3j`](https://explorer.solana.com/tx/5U3cb5iEeKG7j2b8JuEyzP5BRhq9NiN29m7zGEzGK1aiSxWSWcT3G2XJwZ9Rj5dFYkFRZfUoWjXUJHhySnS6my3j?cluster=devnet) | **DEVNET VERIFIED** |
| **Step 3** | Validity Proof Context | [`2Sh6ymADXrtPKrVZkCAu9RjW9kSEkcombcSxGAwvUCqF2UYQoSvFVCj3tKfAsUc9XLoWCvvmzwdpWRM81ngSN9ie`](https://explorer.solana.com/tx/2Sh6ymADXrtPKrVZkCAu9RjW9kSEkcombcSxGAwvUCqF2UYQoSvFVCj3tKfAsUc9XLoWCvvmzwdpWRM81ngSN9ie?cluster=devnet) | **DEVNET VERIFIED** |
| **Step 4** | Confidential Deposit | [`2bDk5pSKA99mNYzEbs2PbbC3dDTrXMZ3PYKFXAYKpTmD8waNYgrGTsiPrXEL7beyeE72neHUodTKThUYQ219CM6e`](https://explorer.solana.com/tx/2bDk5pSKA99mNYzEbs2PbbC3dDTrXMZ3PYKFXAYKpTmD8waNYgrGTsiPrXEL7beyeE72neHUodTKThUYQ219CM6e?cluster=devnet) | **DEVNET VERIFIED** |
| **Step 5** | Source ApplyPending | [`4Usb9hJVoVbCJZCLKVZApUhsNrFRRtpnmC2QFi4eFLRKQa8Bzd8XkvJjcgF4Zta7d9vMuxcjZmLxvPeryYbJuEmH`](https://explorer.solana.com/tx/4Usb9hJVoVbCJZCLKVZApUhsNrFRRtpnmC2QFi4eFLRKQa8Bzd8XkvJjcgF4Zta7d9vMuxcjZmLxvPeryYbJuEmH?cluster=devnet) | **DEVNET VERIFIED** |
| **Step 6** | 169B ConfidentialTransfer | [`2KiygxE9dJX2egQcd1DGywYuZysUSbcYVVXSwLwB3fEuN2PQh5ZMwTk8ViRqwATTTFSs3sH8uiNdzAurJKJzTSZ7`](https://explorer.solana.com/tx/2KiygxE9dJX2egQcd1DGywYuZysUSbcYVVXSwLwB3fEuN2PQh5ZMwTk8ViRqwATTTFSs3sH8uiNdzAurJKJzTSZ7?cluster=devnet) | **DEVNET VERIFIED** |
| **Step 7** | Dest ApplyPending | [`2FRor11UqF7twLSacHMRq1SsLk5BmiZY2AG7GvzrQ1HCGsFmnaqF924qQoPhNjNbHDN95etzsWya7S9L5Xh3yvKR`](https://explorer.solana.com/tx/2FRor11UqF7twLSacHMRq1SsLk5BmiZY2AG7GvzrQ1HCGsFmnaqF924qQoPhNjNbHDN95etzsWya7S9L5Xh3yvKR?cluster=devnet) | **DEVNET VERIFIED** |
| **Step 8** | Confidential Withdraw | [`2QtR6AN4QKz3st39tpoiQKKqpSzE9dqWkkiniqv22hXiBG1DkeVwaR2MZeu1bgL76N1A7xk2ZwcpoDwPkJWG4iTM`](https://explorer.solana.com/tx/2QtR6AN4QKz3st39tpoiQKKqpSzE9dqWkkiniqv22hXiBG1DkeVwaR2MZeu1bgL76N1A7xk2ZwcpoDwPkJWG4iTM?cluster=devnet) | **DEVNET VERIFIED** |

---

## 3. Product Features & State Accounts

| Operation | Target Account | Devnet Transaction Hash | Confirmation Slot |
| :--- | :--- | :--- | :---: |
| **Launch Creation** | `HqeQkTdGW8...` | [`u9kNSqXTkqvL2B35tzKqUdDDyX6Uicffoe6z3uErspr1z8uB2tUDgCgT2dHeiAPk5s72QC7X4mRYCgX43efuxMj`](https://explorer.solana.com/tx/u9kNSqXTkqvL2B35tzKqUdDDyX6Uicffoe6z3uErspr1z8uB2tUDgCgT2dHeiAPk5s72QC7X4mRYCgX43efuxMj?cluster=devnet) | `491269842` |
| **Curation Desk Init** | `GurRuFuc94...` | [`5M9jaPCesoaQH4ZCqTT3KS19doyZR3US3THgvHJNG4ZmYtg1mcNhZjGXi4BM9ZFtHwct4aeXv9qGhSxzMLk7Yf4h`](https://explorer.solana.com/tx/5M9jaPCesoaQH4ZCqTT3KS19doyZR3US3THgvHJNG4ZmYtg1mcNhZjGXi4BM9ZFtHwct4aeXv9qGhSxzMLk7Yf4h?cluster=devnet) | `491042912` |
| **Social Thread & Comment** | `DYEPVp7y...` | [`G8JvtTfYfwBpGXCuxs8WyP4xzv2dPxoWqpnb2ZBX1F1jXq1gJQJGMZ1rtY7vj4uyMjwzHQ7sVmaie1wjnqTTFcr`](https://explorer.solana.com/tx/G8JvtTfYfwBpGXCuxs8WyP4xzv2dPxoWqpnb2ZBX1F1jXq1gJQJGMZ1rtY7vj4uyMjwzHQ7sVmaie1wjnqTTFcr?cluster=devnet) | `491043026` |
| **Fee Router Split** | `fwPLJDmr...` | [`5XPvXCoGmmYmVxhRPAjiHQm4Cyv45yQZUj44Nn9vEQ3MbwFuD1NTdvmxcM3owmpSKZ81nYzsCevCLkXj5ioSintu`](https://explorer.solana.com/tx/5XPvXCoGmmYmVxhRPAjiHQm4Cyv45yQZUj44Nn9vEQ3MbwFuD1NTdvmxcM3owmpSKZ81nYzsCevCLkXj5ioSintu?cluster=devnet) | `491042758` |
| **Settlement Merkle Root** | `3USZayAh...` | [`3RbwJbgCJKhBvJfxdxXK5EPNsxxLwV2Umkf5qGLtorRAdkXAr9n38dAkY1pVLWtzXWTEpEp8wtK8n4V27PYPHA16`](https://explorer.solana.com/tx/3RbwJbgCJKhBvJfxdxXK5EPNsxxLwV2Umkf5qGLtorRAdkXAr9n38dAkY1pVLWtzXWTEpEp8wtK8n4V27PYPHA16?cluster=devnet) | `491042659` |
| **Disaster Refund Commit** | `7iL2YS9L...` | [`5JydsTsCXAKrtL7MxUUSsubPEmS6H8LzbGHx3GRDECKYYkrfhtK4rZKCeytNUdeV43GHZHJku6EHeKtNmm2w8a2E`](https://explorer.solana.com/tx/5JydsTsCXAKrtL7MxUUSsubPEmS6H8LzbGHx3GRDECKYYkrfhtK4rZKCeytNUdeV43GHZHJku6EHeKtNmm2w8a2E?cluster=devnet) | `491042668` |
