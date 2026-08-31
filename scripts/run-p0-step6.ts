/**
 * Phase 3 Step 6 — ConfidentialTransfer::Transfer on canonical Devnet.
 *
 * Does not rewrite Norr. Uses the 169-byte official TransferInstructionData
 * and proofs from tools/ct-proof-gen (solana-zk-sdk 7.0.1).
 *
 * Balance-mismatch (0x1b) is:
 *   subtract_with_lo_hi(available, ct_lo[0], ct_hi[0])
 *     != equality_proof.ciphertext
 *
 * This runner fetches the source available ciphertext, generates remaining
 * as that subtraction, posts fresh proof contexts, then Transfers.
 */
import {
  getInitializeAccountInstruction,
  getReallocateInstructionDataEncoder,
  getConfigureConfidentialTransferAccountInstruction,
  getEnableConfidentialCreditsInstruction,
  getEnableNonConfidentialCreditsInstruction,
  getInitializeMintInstruction,
  getInitializeConfidentialTransferMintInstruction,
  getMintToInstruction,
  getConfidentialDepositInstruction,
  getApplyConfidentialPendingBalanceInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import {
  encodeConfidentialTransferInstructionData,
} from "../packages/confidential/src/transfer-data.ts";
import { ZK_PROOF_INSTRUCTION } from "../packages/confidential/src/proof-ids.ts";
import { buildConfidentialTransfer } from "../packages/confidential/src/instructions.ts";
import {
  getVerifyProofInstruction,
  verifyCiphertextCommitmentEquality,
  verifyBatchedGroupedCiphertext3HandlesValidity,
  verifyBatchedRangeProofU128,
  BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE,
} from "@solana-program/zk-elgamal-proof";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  createRpc, createSolanaRpcApi, createDefaultRpcTransport,
  address, createKeyPairSignerFromBytes, createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions, signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction, setTransactionMessageFeePayerSigner,
  generateKeyPairSigner,
} from "@solana/kit";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { safeJson } from "./safe-json.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const RPC_URL = process.env.NORR_RPC ?? "https://api.devnet.solana.com";
const HISTORICAL_MINT = "6RBs6aoEpQZ59aKfpqWE2SnAX3cysBo3whFuhBoe9suT";
const HISTORICAL_SOURCE = "HKrZcotGz9MCJz1yLzBq4Cd6mYFViNb8iCgtY3gTRSMm";
const AUDITOR_B58 = "FbcHANHTBJKZ153AwhNYD2ZWihFHT2hiYWdiiiHFoyxq";
const SYSVAR_IX = address("Sysvar1nstructions1111111111111111111111111");
const DEPOSIT_AMOUNT = 50_000n;
const TRANSFER_AMOUNT = 10_000n;
const DECIMALS = 6;

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58decode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error(`bad base58: ${c}`);
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const pad = s.match(/^1*/)?.[0].length ?? 0;
  return Uint8Array.from([...Array(pad).fill(0), ...Buffer.from(hex, "hex")]);
}

function toHex(u: Uint8Array): string {
  return Buffer.from(u).toString("hex");
}

function fromHex(h: string): Uint8Array {
  return Uint8Array.from(Buffer.from(h, "hex"));
}
