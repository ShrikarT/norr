# Norr Phase 3 — Step 6 report (2026-08-31)

Architecture was not rewritten. Token-2022 Confidential Transfers, ZK ElGamal
proofs, P0Required, Sale-PDA custody, and the fail-closed wrap/claim gates remain.

## A. Root cause of Balance mismatch

Token-2022 `process_source_for_transfer` (zk-ops path):

```
new_available = subtract_with_lo_hi(
    on_chain_available,
    proof_context.ciphertext_lo.handle_0,
    proof_context.ciphertext_hi.handle_0,
)
if new_available != proof_context.new_source_ciphertext {
    return TokenError::ConfidentialTransferBalanceMismatch // 0x1b
}
```

`new_source_ciphertext` is the equality-proof context ciphertext.

The 169-byte layout was already correct. Dummy / stale proof contexts produced a
remaining ciphertext that was not `available − transfer_lo − 2¹⁶·transfer_hi`.
That is the mismatch. Canonical Devnet zk-ops is live.

## B. Code changes (targeted)

- `packages/confidential/src/transfer-data.ts` — official 169-byte layout + field offsets.
- `packages/confidential/src/proof-ids.ts` — native ZK discriminators (eq=3, range=7, batched-3handle=12).
- `packages/confidential/src/instructions.ts` — `buildConfidentialTransfer` still emits 169 bytes, offset 0, no sysvar.
- `tools/ct-proof-gen` — remaining ciphertext is the homomorphic subtraction Token-2022 will compute; optional on-chain `available_ciphertext_hex`; self-verified proofs 320 / 544 / 1000.
- `scripts/run-p0-step6.ts` — diagnose historical account, generate official proofs, and (with `NORR_PAYER`) mint / deposit / apply / post contexts / Transfer.

P0Required was not touched.

## C. Official TransferInstructionData encoding

spl-token-2022-interface `TransferInstructionData` / Token-2022 11.0.0:

| Offset | Field | Size |
|---|---|---|
| 0 | ConfidentialTransfer extension disc | 1 (27) |
| 1 | Transfer inner disc | 1 (7) |
| 2 | new_source_decryptable_available_balance | 36 |
| 38 | transfer_amount_auditor_ciphertext_lo | 64 |
| 102 | transfer_amount_auditor_ciphertext_hi | 64 |
| 166 | equality_proof_instruction_offset | i8 |
| 167 | ciphertext_validity_proof_instruction_offset | i8 |
| 168 | range_proof_instruction_offset | i8 |
| **total** | | **169** |

`@solana-program/token-2022@0.4.2` still encodes the 41-byte subset. Norr does not use that encoder for Transfer.

## D. Proof / context arrangement

Offsets all `0` ⇒ no instructions sysvar. Account order:

1. source (writable)
2. mint
3. destination (writable)
4. equality context (`VerifyCiphertextCommitmentEquality`, disc 3)
5. batched 3-handle validity context (disc 12)
6. batched range U128 context (disc 7)
7. authority (signer)

Range bit lengths `[64, 16, 32, 16]` as required by `TransferProofContext::verify_and_extract`.

Proofs are posted in prior transactions (range proof is 1000 B and cannot share a 1232-byte tx with Transfer).

## E–J. Real Devnet transfer

Historical source `HKrZcot…` is owned by `FWvsL5EBeQCSDHsTT5mmaohTGrdVZq88jY6uzASUKAfV`. The gitignored `wsl-payer.json` / ElGamal secret are not in this workspace, so that account cannot be spent here.

| Field | Value |
|---|---|
| E. Signature | **none** — no funded payer in this workspace |
| F. Slot | n/a |
| G. Tx size | n/a (169-byte instruction; full signed tx measured only on submit) |
| H. CU | dummy 169-byte sim 3422; real CU only after confirmation |
| I. Source post-state | historical account unchanged |
| J. Dest post-state | not created |

`scripts/run-p0-step6.ts` with `NORR_PAYER` creates a **new** mint using auditor `FbcHANHTBJKZ153AwhNYD2ZWihFHT2hiYWdiiiHFoyxq`, deposits, applies, proves against the live available ciphertext, and submits Transfer.

## K. Negative tests

Unit: wrong-sized auditor ciphertexts rejected; i8 offsets; 41-byte encoder preserved as non-live.

On-chain (when payer present): altered auditor hi is simulated and must fail before the real Transfer.

Local: `ct-proof-gen` asserts remaining ciphertext equals `available − lo − 2¹⁶·hi` for zero-opening available (the deposit/apply case).

## L. Step 6 status

**PARTIAL**

- Encoder: IMPLEMENTED / LOCAL VERIFIED
- Official proofs + homomorphic remaining: LOCAL VERIFIED
- zk-ops on canonical Devnet: DEVNET VERIFIED (process_transfer runs)
- Confirmed ConfidentialTransfer signature: **not yet** (funded payer required)
- P0: still closed

Do not treat local proof success or 169-byte parse success as a completed Step 6.
