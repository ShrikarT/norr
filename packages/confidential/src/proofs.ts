import { type Address } from "@solana/kit";
import { type ElGamalKeypair, type ElGamalPubkey } from "@solana/zk-sdk";

export type ProofContextOptions = {
  mint: Address;
  clusterGenesisHash: string;
};

/**
 * Browser/JS `@solana/zk-sdk` 0.5.2 (the published npm package) cannot generate
 * proof bytes. Official proving is `solana-zk-sdk` 7.0.1 via
 * `tools/ct-proof-gen` (equality 320B, 3-handle validity 544B, range U128 1000B).
 *
 * Do not substitute a custom proving system.
 */
export async function createEqualityProof(
  _sourceKeypair: ElGamalKeypair,
  _destinationPubkey: ElGamalPubkey,
  _amount: bigint,
  _options: ProofContextOptions
): Promise<never> {
  throw new Error(
    "Proof generation is not available in @solana/zk-sdk 0.5.2. Use tools/ct-proof-gen (solana-zk-sdk 7.0.1)."
  );
}

export async function createRangeProof(
  _sourceKeypair: ElGamalKeypair,
  _amount: bigint,
  _options: ProofContextOptions
): Promise<never> {
  throw new Error(
    "Proof generation is not available in @solana/zk-sdk 0.5.2. Use tools/ct-proof-gen (solana-zk-sdk 7.0.1)."
  );
}

export async function createCiphertextValidityProof(
  _sourceKeypair: ElGamalKeypair,
  _destinationPubkey: ElGamalPubkey,
  _auditorPubkey: ElGamalPubkey,
  _amount: bigint,
  _options: ProofContextOptions & { auditorEpoch: number }
): Promise<never> {
  throw new Error(
    "Proof generation is not available in @solana/zk-sdk 0.5.2. Use tools/ct-proof-gen (solana-zk-sdk 7.0.1)."
  );
}
