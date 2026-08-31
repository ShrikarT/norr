/**
 * Native ZK ElGamal proof-program instruction discriminators
 * (`solana-zk-elgamal-proof-interface` ProofInstruction, repr(u8)).
 *
 * These are the values Token-2022 `verify_transfer_proof` expects when
 * posting context accounts (proof instruction offset = 0).
 */
export const ZK_PROOF_INSTRUCTION = {
  closeContextState: 0,
  verifyZeroCiphertext: 1,
  verifyCiphertextCiphertextEquality: 2,
  /** CiphertextCommitmentEquality — remaining-balance equality for Transfer. */
  verifyCiphertextCommitmentEquality: 3,
  verifyPubkeyValidity: 4,
  verifyPercentageWithCap: 5,
  verifyBatchedRangeProofU64: 6,
  /** BatchedRangeProofU128 — Transfer uses bit lengths [64, 16, 32, 16]. */
  verifyBatchedRangeProofU128: 7,
  verifyBatchedRangeProofU256: 8,
  verifyGroupedCiphertext2HandlesValidity: 9,
  verifyBatchedGroupedCiphertext2HandlesValidity: 10,
  verifyGroupedCiphertext3HandlesValidity: 11,
  /** Batched 3-handle validity — Transfer amount lo/hi under src/dst/auditor. */
  verifyBatchedGroupedCiphertext3HandlesValidity: 12,
} as const;

export const TRANSFER_RANGE_BIT_LENGTHS = [64, 16, 32, 16] as const;
export const EQUALITY_PROOF_DATA_LEN = 320;
export const BATCHED_3HANDLE_VALIDITY_PROOF_DATA_LEN = 544;
export const RANGE_U128_PROOF_DATA_LEN = 1000;
