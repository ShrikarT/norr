import { pbkdf2Sync } from "crypto";
import { AeKey, ElGamalKeypair } from "@solana/zk-sdk";

export function deriveConfidentialKeys(
  signMessageOutput: Uint8Array,
  version: string,
  genesisHash: string,
  walletPubkey: string,
  mint: string
): { elGamal: ElGamalKeypair; aeKey: AeKey } {
  const context = "norr-confidential-v1|" + version + "|" + genesisHash + "|" + walletPubkey + "|" + mint;
  const contextBuffer = Buffer.from(context, "utf8");
  
  const derivedSeed = pbkdf2Sync(signMessageOutput, contextBuffer, 100000, 32, "sha256");
  
  const elGamal = ElGamalKeypair.fromSeed(derivedSeed);
  const aeKey = AeKey.fromBytes(derivedSeed);
  
  return { elGamal, aeKey };
}
