import type { Address, TransactionSigner } from "@solana/kit";
import {
  getInitializeConfidentialTransferMintInstruction,
  getConfidentialDepositInstruction,
  getApplyConfidentialPendingBalanceInstruction,
  getEnableConfidentialCreditsInstruction,
  getConfigureConfidentialTransferAccountInstructionDataEncoder,
  getConfidentialWithdrawInstructionDataEncoder,
} from "@solana-program/token-2022";
import { TOKEN_2022_PROGRAM_ID } from "./cluster.js";
import {
  encodeConfidentialTransferInstructionData,
} from "./transfer-data.js";

export { encodeConfidentialTransferInstructionData } from "./transfer-data.js";

export function buildConfigureConfidentialTransferAccount(args: {
  token: Address;
  mint: Address;
  authority: Address | TransactionSigner;
  decryptableZeroBalance: Uint8Array;
  maximumPendingBalanceCreditCounter?: bigint;
  instructionsSysvarOrContextState?: Address;
  record?: Address;
  proofInstructionOffset?: number;
}) {
  const data = getConfigureConfidentialTransferAccountInstructionDataEncoder().encode({
    decryptableZeroBalance: args.decryptableZeroBalance,
    maximumPendingBalanceCreditCounter: args.maximumPendingBalanceCreditCounter ?? 65536n,
    proofInstructionOffset: args.proofInstructionOffset ?? -1,
  });

  const authorityAddress =
    typeof args.authority === "string"
      ? args.authority
      : ((args.authority as TransactionSigner).address as Address);

  const accounts: Array<{ address: Address; role: number; signer?: TransactionSigner }> = [
    { address: args.token, role: 1 },
    { address: args.mint, role: 0 },
    {
      address: args.instructionsSysvarOrContextState ?? ("Sysvar1nstructions1111111111111111111111111" as Address),
      role: 0,
    },
  ];

  if (args.record) {
    accounts.push({ address: args.record, role: 0 });
  }

  accounts.push({
    address: authorityAddress,
    role: 2,
    ...(typeof args.authority === "object" ? { signer: args.authority } : {}),
  });

  return {
    programAddress: TOKEN_2022_PROGRAM_ID,
    accounts,
    data,
  };
}

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
    expectedPendingBalanceCreditCounter,
    newDecryptableAvailableBalance: new Uint8Array(36),
  });
}

/**
 * Confidential Transfer instruction using the official 169-byte layout
 * (includes auditor ElGamal ciphertexts lo/hi).
 *
 * Proof offsets of 0 mean "use the following proof-context accounts".
 */
export function buildConfidentialTransfer(args: {
  sourceToken: Address;
  mint: Address;
  destinationToken: Address;
  authority: Address | TransactionSigner;
  newSourceDecryptableAvailableBalance: Uint8Array;
  transferAmountAuditorCiphertextLo: Uint8Array;
  transferAmountAuditorCiphertextHi: Uint8Array;
  equalityProofContext: Address;
  ciphertextValidityProofContext: Address;
  rangeProofContext: Address;
  equalityProofOffset?: number;
  ciphertextValidityProofOffset?: number;
  rangeProofOffset?: number;
}) {
  const data = encodeConfidentialTransferInstructionData({
    newSourceDecryptableAvailableBalance: args.newSourceDecryptableAvailableBalance,
    transferAmountAuditorCiphertextLo: args.transferAmountAuditorCiphertextLo,
    transferAmountAuditorCiphertextHi: args.transferAmountAuditorCiphertextHi,
    equalityProofInstructionOffset: args.equalityProofOffset ?? 0,
    ciphertextValidityProofInstructionOffset: args.ciphertextValidityProofOffset ?? 0,
    rangeProofInstructionOffset: args.rangeProofOffset ?? 0,
  });

  const authorityAddress =
    typeof args.authority === "string"
      ? args.authority
      : ((args.authority as TransactionSigner).address as Address);

  return {
    programAddress: TOKEN_2022_PROGRAM_ID,
    accounts: [
      { address: args.sourceToken, role: 1 },
      { address: args.mint, role: 0 },
      { address: args.destinationToken, role: 1 },
      { address: args.equalityProofContext, role: 0 },
      { address: args.ciphertextValidityProofContext, role: 0 },
      { address: args.rangeProofContext, role: 0 },
      {
        address: authorityAddress,
        role: 2,
        ...(typeof args.authority === "object" ? { signer: args.authority } : {}),
      },
    ],
    data,
  };
}

export function buildConfidentialWithdraw(args: {
  token: Address;
  mint: Address;
  authority: Address | TransactionSigner;
  amount: bigint;
  decimals: number;
  newDecryptableAvailableBalance: Uint8Array;
  equalityProofContext: Address;
  rangeProofContext: Address;
  equalityProofOffset?: number;
  rangeProofOffset?: number;
}) {
  const data = getConfidentialWithdrawInstructionDataEncoder().encode({
    amount: args.amount,
    decimals: args.decimals,
    newDecryptableAvailableBalance: args.newDecryptableAvailableBalance,
    equalityProofInstructionOffset: args.equalityProofOffset ?? 0,
    rangeProofInstructionOffset: args.rangeProofOffset ?? 0,
  });

  const authorityAddress =
    typeof args.authority === "string"
      ? args.authority
      : ((args.authority as TransactionSigner).address as Address);

  return {
    programAddress: TOKEN_2022_PROGRAM_ID,
    accounts: [
      { address: args.token, role: 1 },
      { address: args.mint, role: 0 },
      { address: args.equalityProofContext, role: 0 },
      { address: args.rangeProofContext, role: 0 },
      {
        address: authorityAddress,
        role: 2,
        ...(typeof args.authority === "object" ? { signer: args.authority } : {}),
      },
    ],
    data,
  };
}

export { getEnableConfidentialCreditsInstruction };
