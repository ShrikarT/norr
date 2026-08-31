# P0 Phase 3 re-investigation (2026-08-31)

This supersedes the conclusion in `p0-phase3-blocked.md` that canonical
Token-2022 was compiled **without** `zk-ops`. That conclusion was wrong for
the current Devnet binary. It was inferred from `InvalidInstructionData` after
`ConfidentialTransferInstruction::Transfer`, which is also what
`decode_instruction_data::<TransferInstructionData>` returns when the payload
is the wrong size.

The subsequent `Balance mismatch` (Custom 0x1b) is **not** a cluster capability
failure either. It is `process_source_for_transfer` rejecting a remaining
ciphertext that is not `available − ct_lo[0] − 2^16·ct_hi[0]`.

## Live RPC facts (canonical Devnet)

| Item | Value |
|---|---|
| RPC | `https://api.devnet.solana.com` |
| `solana-core` | `4.3.0-beta.2` |
| Genesis | `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` |
| Token-2022 | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` (upgradeable) |
| Last Token-2022 deploy slot | `461026092` (2026-05-08T21:46:19Z) — same day as `spl-token-2022 11.0.0` |
| ZK ElGamal Proof Program | `ZkE1Gama1Proof11111111111111111111111111111` (native, executable) |
| `spl-token-2022` crate | `11.0.0`, `default = ["zk-ops"]` |

## Simulation (same cluster)

Against mint `6RBs6ao…` / account `HKrZcot…`:

| Payload | Result | CU |
|---|---|---|
| 41-byte Transfer — old Norr encoder | `InvalidInstructionData` | 1785 |
| 169-byte Transfer, dummy remaining | `Balance mismatch` (0x1b) | 3422 |
| ApplyPendingBalance | success | 7967 |
| Deposit | success | 9892 |

## Exact mismatch equality

```
new_available = subtract_with_lo_hi(available, proof.ct_lo[0], proof.ct_hi[0])
require new_available == equality_proof.ciphertext
```

`tools/ct-proof-gen` now constructs remaining by that subtraction (optionally
from the on-chain available ciphertext). Local tests: homomorphic match = true;
proof sizes 320 / 544 / 1000.

## Historical source cannot be spent here

Owner `FWvsL5EBeQCSDHsTT5mmaohTGrdVZq88jY6uzASUKAfV`. ElGamal pubkey
`HHxn6zwHfL4DiUQNCWckJuVw3V7QumC2bhcJ4dT3NEiG`. Available handle is not
identity (opening unknown). `wsl-payer.json` is gitignored.

## Step 6

PARTIAL. Encoder and official proofs are ready. A confirmed Transfer still
needs `NORR_PAYER`. P0Required is unchanged.
