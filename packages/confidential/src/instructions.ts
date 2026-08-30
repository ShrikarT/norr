import type { Address, TransactionSigner } from "@solana/kit";
import {
  getInitializeConfidentialTransferMintInstruction,
  getConfigureConfidentialTransferAccountInstruction,
  getConfidentialDepositInstruction,
  getApplyConfidentialPendingBalanceInstruction,
  getConfidentialTransferInstruction,
  getConfidentialWithdrawInstruction,
  getEmptyConfidentialTransferAccountInstruction,
  getEnableConfidentialCreditsInstruction,
  getDisableConfidentialCreditsInstruction,
  getEnableNonConfidentialCreditsInstruction,
  getDisableNonConfidentialCreditsInstruction
} from "@solana-program/token-2022";

export function buildInitializeConfidentialTransferMint(
  mint: Address,
  authority: Address,
  autoApproveNewAccounts: boolean,
  auditorElGamalPubkey?: Address
) {
  return getInitializeConfidentialTransferMintInstruction({
    mint,
    authority,
    autoApproveNewAccounts,
    auditorElgamalPubkey: auditorElGamalPubkey ?? null,
  });
}

export function buildConfidentialDeposit(
  token: Address,
  mint: Address,
  authority: Address | TransactionSigner,
  amount: bigint,
  decimals: number
) {
  return getConfidentialDepositInstruction({
    token,
    mint,
    authority,
    amount,
    decimals,
  });
}

export function buildApplyConfidentialPendingBalance(
  token: Address,
  authority: Address | TransactionSigner,
  expectedPendingBalanceCreditCounter: bigint
) {
  return getApplyConfidentialPendingBalanceInstruction({
    token,
    authority,
    expectedPendingBalanceCreditCounter, newDecryptableAvailableBalance: new Uint8Array(36),
  });
}

export function buildConfidentialTransfer(
  sourceToken: Address,
  mint: Address,
  destinationToken: Address,
  authority: Address | TransactionSigner,
  newSourceDecryptableAvailableBalance: Uint8Array,
  equalityProofOffset: number,
  ciphertextValidityProofOffset: number,
  rangeProofOffset: number,
  instructionsSysvar?: Address
) {
  return getConfidentialTransferInstruction({
    sourceToken,
    mint,
    destinationToken,
    authority,
    newSourceDecryptableAvailableBalance,
    equalityProofInstructionOffset: equalityProofOffset,
    ciphertextValidityProofInstructionOffset: ciphertextValidityProofOffset,
    rangeProofInstructionOffset: rangeProofOffset,
    instructionsSysvar: instructionsSysvar ?? undefined,
  } as any);
}
