import assert from "node:assert/strict";
import test from "node:test";
import {
  CONFIDENTIAL_TRANSFER_DATA_LEN,
  TRANSFER_FIELD_OFFSETS,
  encodeConfidentialTransferInstructionData,
  encodeLegacyIncompleteTransferInstructionData,
} from "../src/transfer-data.js";
import {
  EQUALITY_PROOF_DATA_LEN,
  BATCHED_3HANDLE_VALIDITY_PROOF_DATA_LEN,
  RANGE_U128_PROOF_DATA_LEN,
  ZK_PROOF_INSTRUCTION,
  TRANSFER_RANGE_BIT_LENGTHS,
} from "../src/proof-ids.js";

test("official Transfer payload is 169 bytes with auditor ciphertexts at official offsets", () => {
  const decryptable = new Uint8Array(36).fill(1);
  const lo = new Uint8Array(64).fill(2);
  const hi = new Uint8Array(64).fill(3);
  const data = encodeConfidentialTransferInstructionData({
    newSourceDecryptableAvailableBalance: decryptable,
    transferAmountAuditorCiphertextLo: lo,
    transferAmountAuditorCiphertextHi: hi,
    equalityProofInstructionOffset: 0,
    ciphertextValidityProofInstructionOffset: 0,
    rangeProofInstructionOffset: 0,
  });
  assert.equal(data.length, CONFIDENTIAL_TRANSFER_DATA_LEN);
  assert.equal(CONFIDENTIAL_TRANSFER_DATA_LEN, 2 + 36 + 64 + 64 + 3);
  assert.equal(data[TRANSFER_FIELD_OFFSETS.discriminator], 27);
  assert.equal(data[TRANSFER_FIELD_OFFSETS.inner], 7);
  assert.deepEqual(data.slice(TRANSFER_FIELD_OFFSETS.decryptable, TRANSFER_FIELD_OFFSETS.auditorLo), decryptable);
  assert.deepEqual(data.slice(TRANSFER_FIELD_OFFSETS.auditorLo, TRANSFER_FIELD_OFFSETS.auditorHi), lo);
  assert.deepEqual(data.slice(TRANSFER_FIELD_OFFSETS.auditorHi, TRANSFER_FIELD_OFFSETS.equalityOffset), hi);
  assert.equal(data[TRANSFER_FIELD_OFFSETS.equalityOffset], 0);
  assert.equal(data[TRANSFER_FIELD_OFFSETS.validityOffset], 0);
  assert.equal(data[TRANSFER_FIELD_OFFSETS.rangeOffset], 0);
});

test("encodes negative i8 proof offsets as two's complement", () => {
  const data = encodeConfidentialTransferInstructionData({
    newSourceDecryptableAvailableBalance: new Uint8Array(36),
    transferAmountAuditorCiphertextLo: new Uint8Array(64),
    transferAmountAuditorCiphertextHi: new Uint8Array(64),
    equalityProofInstructionOffset: -1,
    ciphertextValidityProofInstructionOffset: -2,
    rangeProofInstructionOffset: 3,
  });
  assert.equal(data[166], 0xff);
  assert.equal(data[167], 0xfe);
  assert.equal(data[168], 3);
});

test("legacy incomplete encoder is 41 bytes and is not the live layout", () => {
  const data = encodeLegacyIncompleteTransferInstructionData(new Uint8Array(36));
  assert.equal(data.length, 41);
  assert.equal(data[0], 27);
  assert.equal(data[1], 7);
});

test("rejects wrong-sized auditor ciphertexts", () => {
  assert.throws(() =>
    encodeConfidentialTransferInstructionData({
      newSourceDecryptableAvailableBalance: new Uint8Array(36),
      transferAmountAuditorCiphertextLo: new Uint8Array(32),
      transferAmountAuditorCiphertextHi: new Uint8Array(64),
      equalityProofInstructionOffset: 0,
      ciphertextValidityProofInstructionOffset: 0,
      rangeProofInstructionOffset: 0,
    })
  );
});

test("official ZK proof discriminators and sizes match Token-2022 transfer", () => {
  assert.equal(ZK_PROOF_INSTRUCTION.verifyCiphertextCommitmentEquality, 3);
  assert.equal(ZK_PROOF_INSTRUCTION.verifyPubkeyValidity, 4);
  assert.equal(ZK_PROOF_INSTRUCTION.verifyBatchedRangeProofU128, 7);
  assert.equal(ZK_PROOF_INSTRUCTION.verifyBatchedGroupedCiphertext3HandlesValidity, 12);
  assert.deepEqual([...TRANSFER_RANGE_BIT_LENGTHS], [64, 16, 32, 16]);
  assert.equal(EQUALITY_PROOF_DATA_LEN, 320);
  assert.equal(BATCHED_3HANDLE_VALIDITY_PROOF_DATA_LEN, 544);
  assert.equal(RANGE_U128_PROOF_DATA_LEN, 1000);
});
