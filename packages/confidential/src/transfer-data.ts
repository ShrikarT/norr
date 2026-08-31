/**
 * Canonical Token-2022 ConfidentialTransferInstruction::Transfer data layout
 * (spl-token-2022 11.0.0 / interface TransferInstructionData).
 *
 * Outer discriminator 27, inner Transfer = 7.
 *
 *   decryptable available balance     36   // offset 2
 *   auditor ciphertext lo             64   // offset 38
 *   auditor ciphertext hi             64   // offset 102
 *   equality proof offset             i8   // offset 166
 *   ciphertext-validity proof offset  i8   // offset 167
 *   range proof offset                i8   // offset 168
 *
 * Total: 169 bytes.
 *
 * Balance-mismatch (TokenError 0x1b) is NOT a decode failure. After this
 * payload is accepted, `process_source_for_transfer` requires:
 *
 *   subtract_with_lo_hi(on_chain_available, proof.ct_lo[0], proof.ct_hi[0])
 *     == equality_proof_context.ciphertext
 *
 * Dummy / stale proof contexts fail that equality. Matching remaining
 * ciphertext is produced by `tools/ct-proof-gen`.
 */

export const TOKEN_INSTRUCTION_CONFIDENTIAL_TRANSFER_EXTENSION = 27;
export const CONFIDENTIAL_TRANSFER_INSTRUCTION_TRANSFER = 7;
export const AE_CIPHERTEXT_LEN = 36;
export const ELGAMAL_CIPHERTEXT_LEN = 64;
export const CONFIDENTIAL_TRANSFER_DATA_LEN = 169;

export const TRANSFER_FIELD_OFFSETS = {
  discriminator: 0,
  inner: 1,
  decryptable: 2,
  auditorLo: 38,
  auditorHi: 102,
  equalityOffset: 166,
  validityOffset: 167,
  rangeOffset: 168,
} as const;

export type ConfidentialTransferDataArgs = {
  newSourceDecryptableAvailableBalance: Uint8Array;
  transferAmountAuditorCiphertextLo: Uint8Array;
  transferAmountAuditorCiphertextHi: Uint8Array;
  equalityProofInstructionOffset: number;
  ciphertextValidityProofInstructionOffset: number;
  rangeProofInstructionOffset: number;
};

function requireLen(name: string, bytes: Uint8Array, len: number) {
  if (bytes.length !== len) {
    throw new Error(`${name} must be ${len} bytes, got ${bytes.length}`);
  }
}

function i8(n: number): number {
  if (!Number.isInteger(n) || n < -128 || n > 127) {
    throw new Error(`proof offset ${n} is not an i8`);
  }
  return n & 0xff;
}

/** Encode TransferInstructionData for the official Token-2022 program. */
export function encodeConfidentialTransferInstructionData(
  args: ConfidentialTransferDataArgs
): Uint8Array {
  requireLen(
    "newSourceDecryptableAvailableBalance",
    args.newSourceDecryptableAvailableBalance,
    AE_CIPHERTEXT_LEN
  );
  requireLen(
    "transferAmountAuditorCiphertextLo",
    args.transferAmountAuditorCiphertextLo,
    ELGAMAL_CIPHERTEXT_LEN
  );
  requireLen(
    "transferAmountAuditorCiphertextHi",
    args.transferAmountAuditorCiphertextHi,
    ELGAMAL_CIPHERTEXT_LEN
  );

  const out = new Uint8Array(CONFIDENTIAL_TRANSFER_DATA_LEN);
  out[0] = TOKEN_INSTRUCTION_CONFIDENTIAL_TRANSFER_EXTENSION;
  out[1] = CONFIDENTIAL_TRANSFER_INSTRUCTION_TRANSFER;
  out.set(args.newSourceDecryptableAvailableBalance, 2);
  out.set(args.transferAmountAuditorCiphertextLo, 38);
  out.set(args.transferAmountAuditorCiphertextHi, 102);
  out[166] = i8(args.equalityProofInstructionOffset);
  out[167] = i8(args.ciphertextValidityProofInstructionOffset);
  out[168] = i8(args.rangeProofInstructionOffset);
  return out;
}

/** The historically-wrong 41-byte Transfer payload (no auditor ciphertexts). */
export function encodeLegacyIncompleteTransferInstructionData(
  newSourceDecryptableAvailableBalance: Uint8Array,
  equalityProofInstructionOffset = 0,
  ciphertextValidityProofInstructionOffset = 0,
  rangeProofInstructionOffset = 0
): Uint8Array {
  requireLen(
    "newSourceDecryptableAvailableBalance",
    newSourceDecryptableAvailableBalance,
    AE_CIPHERTEXT_LEN
  );
  const out = new Uint8Array(41);
  out[0] = TOKEN_INSTRUCTION_CONFIDENTIAL_TRANSFER_EXTENSION;
  out[1] = CONFIDENTIAL_TRANSFER_INSTRUCTION_TRANSFER;
  out.set(newSourceDecryptableAvailableBalance, 2);
  out[38] = i8(equalityProofInstructionOffset);
  out[39] = i8(ciphertextValidityProofInstructionOffset);
  out[40] = i8(rangeProofInstructionOffset);
  return out;
}
