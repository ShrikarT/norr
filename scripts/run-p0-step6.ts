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

type ProofOut = {
  source_elgamal_pubkey_hex: string;
  dest_elgamal_pubkey_hex: string;
  auditor_elgamal_pubkey_hex: string;
  decryptable_remaining_hex: string;
  decryptable_zero_hex: string;
  decryptable_available_hex: string;
  auditor_ciphertext_lo_hex: string;
  auditor_ciphertext_hi_hex: string;
  remaining_ciphertext_hex: string;
  remaining_matches_homomorphic: boolean;
  equality_proof_hex: string;
  validity_proof_hex: string;
  range_proof_hex: string;
  source_pubkey_proof_hex: string;
  dest_pubkey_proof_hex: string;
  remaining_amount: number;
  transfer_amount: number;
  available_balance: number;
  secrets?: {
    source_elgamal_secret_hex: string;
    dest_elgamal_secret_hex?: string | null;
    source_ae_key_hex: string;
  };
};

function runOfficialProofGen(input: Record<string, unknown>): ProofOut {
  const bin = resolve(repoRoot, "tools/ct-proof-gen/target/release/ct-proof-gen");
  if (!existsSync(bin)) {
    throw new Error("tools/ct-proof-gen is not built. cargo build --release in tools/ct-proof-gen");
  }
  const r = spawnSync(bin, {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`ct-proof-gen failed: ${r.stderr || r.stdout}`);
  }
  const jsonStart = r.stdout.indexOf("{");
  return JSON.parse(r.stdout.slice(jsonStart));
}

async function waitConfirm(rpc: any, sig: string) {
  for (let i = 0; i < 40; i++) {
    try {
      const statuses = await rpc.getSignatureStatuses([sig]).send();
      const stat = statuses.value[0];
      if (stat && (stat.confirmationStatus === "confirmed" || stat.confirmationStatus === "finalized")) {
        return { slot: stat.slot, status: stat.confirmationStatus };
      }
    } catch { /* transient */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Confirmation timed out for ${sig}`);
}

async function sendTx(rpc: any, payer: any, ixs: any[], name: string, opts?: { allowFail?: boolean }) {
  let latestBlockhash: any;
  while (true) {
    try {
      latestBlockhash = (await rpc.getLatestBlockhash({ commitment: "confirmed" }).send()).value;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  let msg = createTransactionMessage({ version: 0 });
  msg = setTransactionMessageFeePayerSigner(payer, msg);
  msg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg);
  msg = appendTransactionMessageInstructions(ixs, msg);
  const signedTx = await signTransactionMessageWithSigners(msg);
  const wire = getBase64EncodedWireTransaction(signedTx);
  const bytes = Buffer.from(wire, "base64").length;

  const sim = await rpc.simulateTransaction(wire, { commitment: "confirmed", encoding: "base64" }).send();
  const logs = sim.value.logs ?? [];
  console.log(`[${name}] sim CU=${sim.value.unitsConsumed} bytes=${bytes} err=${safeJson(sim.value.err)}`);
  if (sim.value.err) {
    console.log(`[${name}] logs:`, logs.slice(-8).join("\n"));
    if (!opts?.allowFail) throw new Error(`Simulation failed for ${name}: ${safeJson(sim.value.err)}`);
    return { sig: null, slot: null, bytes, cu: sim.value.unitsConsumed, logs, err: sim.value.err };
  }
  if (bytes > 1232) throw new Error(`transaction ${name} is ${bytes} bytes > 1232`);
  const start = Date.now();
  const sig = await rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true }).send();
  const conf = await waitConfirm(rpc, sig);
  const latency = Date.now() - start;
  console.log(`[${name}] confirmed slot=${conf.slot} ${conf.status} ${latency}ms sig=${sig}`);
  return { sig, slot: conf.slot, bytes, cu: sim.value.unitsConsumed, latency, logs, err: null };
}

async function parsedAccount(rpc: any, addr: string) {
  const info = await rpc.getAccountInfo(address(addr), { encoding: "jsonParsed", commitment: "confirmed" }).send();
  if (!info.value) return null;
  return info.value.data?.parsed?.info ?? null;
}
