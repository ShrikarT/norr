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
  console.log(`[${name}] sim CU=${sim.value.unitsConsumed} bytes=${bytes} err=${JSON.stringify(sim.value.err)}`);
  if (sim.value.err) {
    console.log(`[${name}] logs:`, logs.slice(-8).join("\n"));
    if (!opts?.allowFail) throw new Error(`Simulation failed for ${name}: ${JSON.stringify(sim.value.err)}`);
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

function ctExt(info: any) {
  return info?.extensions?.find((e: any) => e.extension === "confidentialTransferAccount")?.state;
}

async function diagnoseHistorical(rpc: any) {
  console.log("=== DIAGNOSE historical Devnet source (non-secret fields only) ===");
  const info = await parsedAccount(rpc, HISTORICAL_SOURCE);
  if (!info) {
    console.log("historical source missing");
    return;
  }
  const ct = ctExt(info);
  console.log("owner", info.owner);
  console.log("mint", info.mint);
  console.log("publicAmount", info.tokenAmount?.amount);
  if (ct) {
    const avail = Buffer.from(ct.availableBalance, "base64");
    const handle = avail.subarray(32);
    console.log("elgamalPubkey", ct.elgamalPubkey);
    console.log("approved", ct.approved, "confCredits", ct.allowConfidentialCredits);
    console.log("pendingCounter", ct.pendingBalanceCreditCounter);
    console.log("availableCiphertextLen", avail.length, "handleIdentity", handle.every((b: number) => b === 0));
    console.log("NOTE: spending this account requires the owner key FWvsL5…UKAfV and its ElGamal secret.");
    console.log("wsl-payer.json is gitignored and is not in this workspace. A new mint/account is used instead.");
  }
}

async function runStep6() {
  const rpc = createRpc({
    api: createSolanaRpcApi(),
    transport: createDefaultRpcTransport({ url: RPC_URL }),
  });

  console.log("=== PHASE 3 STEP 6: CONFIDENTIAL TRANSFER ===");
  console.log("RPC", RPC_URL);
  console.log("auditor", AUDITOR_B58);
  await diagnoseHistorical(rpc);

  console.log("\n=== LOCAL official proofs (zero-opening available) ===");
  const local = runOfficialProofGen({
    available_balance: Number(DEPOSIT_AMOUNT),
    transfer_amount: Number(TRANSFER_AMOUNT),
    auditor_pubkey_hex: toHex(b58decode(AUDITOR_B58)),
    emit_secrets: false,
  });
  console.log("eq", local.equality_proof_hex.length / 2, "val", local.validity_proof_hex.length / 2, "range", local.range_proof_hex.length / 2);
  console.log("homomorphic_match", local.remaining_matches_homomorphic);
  if (local.equality_proof_hex.length / 2 !== 320) throw new Error("eq proof size");
  if (local.validity_proof_hex.length / 2 !== 544) throw new Error("val proof size");
  if (local.range_proof_hex.length / 2 !== 1000) throw new Error("range proof size");

  const transferData = encodeConfidentialTransferInstructionData({
    newSourceDecryptableAvailableBalance: fromHex(local.decryptable_remaining_hex),
    transferAmountAuditorCiphertextLo: fromHex(local.auditor_ciphertext_lo_hex),
    transferAmountAuditorCiphertextHi: fromHex(local.auditor_ciphertext_hi_hex),
    equalityProofInstructionOffset: 0,
    ciphertextValidityProofInstructionOffset: 0,
    rangeProofInstructionOffset: 0,
  });
  if (transferData.length !== 169) throw new Error("encoder produced wrong size");
  console.log("169-byte Transfer layout ok; offsets 166-168 =", [...transferData.slice(166)]);

  const payerPath = existsSync(resolve(repoRoot, "wsl-payer.json"))
    ? resolve(repoRoot, "wsl-payer.json")
    : process.env.NORR_PAYER;
  if (!payerPath || !existsSync(payerPath)) {
    console.log("\nNO FUNDED PAYER. Local proofs + encoder are ready. Devnet Transfer not submitted.");
    console.log("Set NORR_PAYER to a funded Devnet keypair JSON to land a real signature.");
    writeFileSync(
      resolve(repoRoot, "docs/step6-partial.json"),
      JSON.stringify({
        status: "PARTIAL",
        reason: "no funded payer",
        encoderBytes: 169,
        equalityProofBytes: 320,
        validityProofBytes: 544,
        rangeProofBytes: 1000,
        remainingMatchesHomomorphic: local.remaining_matches_homomorphic,
        balanceMismatchEquality:
          "subtract_with_lo_hi(available, ct_lo[0], ct_hi[0]) == equality.ciphertext",
      }, null, 2)
    );
    return { status: "PARTIAL" };
  }

  const payer = await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(readFileSync(payerPath, "utf-8"))));
  const bal = await rpc.getBalance(payer.address, { commitment: "confirmed" }).send();
  console.log("payer", payer.address, "lamports", bal.value);
  if (bal.value === 0n) throw new Error("payer unfunded");

  const auditor = address(AUDITOR_B58);

  const bootstrap = runOfficialProofGen({
    available_balance: Number(DEPOSIT_AMOUNT),
    transfer_amount: Number(TRANSFER_AMOUNT),
    auditor_pubkey_hex: toHex(b58decode(AUDITOR_B58)),
    emit_secrets: true,
  });
  if (!bootstrap.secrets) throw new Error("proof-gen did not emit secrets for account setup");

  console.log("\n=== STEP 1 (this run): confidential mint ===");
  const mintSigner = await generateKeyPairSigner();
  const mintRent = await rpc.getMinimumBalanceForRentExemption(235n, { commitment: "confirmed" }).send();
  const createMint = getCreateAccountInstruction({
    payer, newAccount: mintSigner, lamports: mintRent, space: 235,
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
  });
  const initCtMint = getInitializeConfidentialTransferMintInstruction({
    mint: mintSigner.address,
    authority: payer.address,
    autoApproveNewAccounts: true,
    auditorElgamalPubkey: auditor,
  });
  const initMint = getInitializeMintInstruction({
    mint: mintSigner.address,
    decimals: DECIMALS,
    mintAuthority: payer.address,
    freezeAuthority: payer.address,
  });
  const mintTx = await sendTx(rpc, payer, [createMint, initCtMint, initMint], "mint");

  async function createCtAccount(label: string, pubkeyProofHex: string, decryptableZeroHex: string) {
    const token = await generateKeyPairSigner();
    const rent = await rpc.getMinimumBalanceForRentExemption(165n, { commitment: "confirmed" }).send();
    const create = getCreateAccountInstruction({
      payer, newAccount: token, lamports: rent, space: 165,
      programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    });
    const init = getInitializeAccountInstruction({
      account: token.address, mint: mintSigner.address, owner: payer.address,
    });
    const reallocData = getReallocateInstructionDataEncoder().encode({ newExtensionTypes: [7, 5] });
    const realloc = {
      programAddress: TOKEN_2022_PROGRAM_ADDRESS,
      accounts: [
        { address: token.address, role: 1 },
        { address: payer.address, role: 3, signer: payer },
        { address: address("11111111111111111111111111111111"), role: 0 },
        { address: payer.address, role: 2, signer: payer },
      ],
      data: reallocData,
    };
    const verifyPk = getVerifyProofInstruction({
      discriminator: ZK_PROOF_INSTRUCTION.verifyPubkeyValidity,
      proofData: fromHex(pubkeyProofHex),
    });
    const configure = getConfigureConfidentialTransferAccountInstruction({
      token: token.address,
      mint: mintSigner.address,
      instructionsSysvarOrContextState: SYSVAR_IX,
      authority: payer,
      decryptableZeroBalance: fromHex(decryptableZeroHex),
      maximumPendingBalanceCreditCounter: 65536n,
      proofInstructionOffset: -1,
    });
    const enableC = getEnableConfidentialCreditsInstruction({ token: token.address, authority: payer });
    const enableN = getEnableNonConfidentialCreditsInstruction({ token: token.address, authority: payer });
    await sendTx(rpc, payer, [create, init, realloc, verifyPk, configure, enableC, enableN], label);
    return token;
  }

  console.log("\n=== STEP 2: source + destination CT accounts ===");
  const source = await createCtAccount("source-account", bootstrap.source_pubkey_proof_hex, bootstrap.decryptable_zero_hex);
  const destProof = runOfficialProofGen({
    available_balance: Number(DEPOSIT_AMOUNT),
    transfer_amount: Number(TRANSFER_AMOUNT),
    auditor_pubkey_hex: toHex(b58decode(AUDITOR_B58)),
    emit_secrets: true,
  });
  const dest = await createCtAccount("dest-account", destProof.source_pubkey_proof_hex, destProof.decryptable_zero_hex);

  console.log("source", source.address);
  console.log("dest", dest.address);
  console.log("mint", mintSigner.address);

  console.log("\n=== STEP 4/5: mint + deposit + apply ===");
  const mintTo = getMintToInstruction({
    mint: mintSigner.address,
    token: source.address,
    mintAuthority: payer,
    amount: DEPOSIT_AMOUNT,
  });
  await sendTx(rpc, payer, [mintTo], "mintTo");

  const deposit = getConfidentialDepositInstruction({
    token: source.address,
    mint: mintSigner.address,
    authority: payer,
    amount: DEPOSIT_AMOUNT,
    decimals: DECIMALS,
  });
  await sendTx(rpc, payer, [deposit], "deposit");

  const apply = getApplyConfidentialPendingBalanceInstruction({
    token: source.address,
    authority: payer,
    expectedPendingBalanceCreditCounter: 1n,
    newDecryptableAvailableBalance: fromHex(bootstrap.decryptable_available_hex),
  });
  await sendTx(rpc, payer, [apply], "apply");

  const srcInfo = await parsedAccount(rpc, source.address);
  const srcCt = ctExt(srcInfo);
  if (!srcCt) throw new Error("source missing CT extension after apply");
  const availableCt = Buffer.from(srcCt.availableBalance, "base64");
  console.log("on-chain available ciphertext", availableCt.length, "bytes");
  console.log("pendingCounter", srcCt.pendingBalanceCreditCounter);

  console.log("\n=== STEP 6 proofs bound to on-chain available ciphertext ===");
  const proofs = runOfficialProofGen({
    source_secret_hex: bootstrap.secrets.source_elgamal_secret_hex,
    dest_pubkey_hex: destProof.source_elgamal_pubkey_hex,
    auditor_pubkey_hex: toHex(b58decode(AUDITOR_B58)),
    source_ae_key_hex: bootstrap.secrets.source_ae_key_hex,
    available_balance: Number(DEPOSIT_AMOUNT),
    transfer_amount: Number(TRANSFER_AMOUNT),
    available_ciphertext_hex: toHex(availableCt),
    emit_secrets: false,
  });
  console.log("homomorphic_match", proofs.remaining_matches_homomorphic);
  console.log("remaining_amount", proofs.remaining_amount);

  console.log("\n=== post proof contexts ===");
  const eqCtx = await generateKeyPairSigner();
  const valCtx = await generateKeyPairSigner();
  const rangeCtx = await generateKeyPairSigner();

  const eqIxs = await verifyCiphertextCommitmentEquality({
    rpc, payer,
    proofData: fromHex(proofs.equality_proof_hex),
    contextState: { contextAccount: eqCtx, authority: payer.address },
  });
  await sendTx(rpc, payer, eqIxs, "eq-context");

  const valIxs = await verifyBatchedGroupedCiphertext3HandlesValidity({
    rpc, payer,
    proofData: fromHex(proofs.validity_proof_hex),
    contextState: { contextAccount: valCtx, authority: payer.address },
  });
  await sendTx(rpc, payer, valIxs, "val-context");

  const rangeIxs = await verifyBatchedRangeProofU128({
    rpc, payer,
    proofData: fromHex(proofs.range_proof_hex),
    contextState: { contextAccount: rangeCtx, authority: payer.address },
  });
  const rangeBytesGuess = proofs.range_proof_hex.length / 2;
  if (rangeIxs.length > 1) {
    await sendTx(rpc, payer, [rangeIxs[0]], "range-create");
    await sendTx(rpc, payer, rangeIxs.slice(1), "range-verify");
  } else {
    try {
      await sendTx(rpc, payer, rangeIxs, "range-context");
    } catch (e) {
      console.log("range combined failed, splitting. context size", BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE, rangeBytesGuess);
      throw e;
    }
  }

  console.log("\n=== TRANSFER (offset 0, context accounts) ===");
  const ixTransfer = buildConfidentialTransfer({
    sourceToken: source.address,
    mint: mintSigner.address,
    destinationToken: dest.address,
    authority: payer,
    newSourceDecryptableAvailableBalance: fromHex(proofs.decryptable_remaining_hex),
    transferAmountAuditorCiphertextLo: fromHex(proofs.auditor_ciphertext_lo_hex),
    transferAmountAuditorCiphertextHi: fromHex(proofs.auditor_ciphertext_hi_hex),
    equalityProofContext: eqCtx.address,
    ciphertextValidityProofContext: valCtx.address,
    rangeProofContext: rangeCtx.address,
    equalityProofOffset: 0,
    ciphertextValidityProofOffset: 0,
    rangeProofOffset: 0,
  });

  const negResults: Record<string, unknown> = {};
  const mutated = encodeConfidentialTransferInstructionData({
    newSourceDecryptableAvailableBalance: fromHex(proofs.decryptable_remaining_hex),
    transferAmountAuditorCiphertextLo: fromHex(proofs.auditor_ciphertext_lo_hex),
    transferAmountAuditorCiphertextHi: new Uint8Array(64),
    equalityProofInstructionOffset: 0,
    ciphertextValidityProofInstructionOffset: 0,
    rangeProofInstructionOffset: 0,
  });
  const badIx = { ...ixTransfer, data: mutated };
  const bad = await sendTx(rpc, payer, [badIx], "neg-altered-auditor-hi", { allowFail: true });
  negResults.alteredAuditorHi = { err: bad.err, cu: bad.cu };

  const transferResult = await sendTx(rpc, payer, [ixTransfer], "confidential-transfer");

  const srcAfter = ctExt(await parsedAccount(rpc, source.address));
  const dstAfter = ctExt(await parsedAccount(rpc, dest.address));
  console.log("SOURCE pending", srcAfter?.pendingBalanceCreditCounter, "availableLen", Buffer.from(srcAfter?.availableBalance ?? "", "base64").length);
  console.log("DEST pending", dstAfter?.pendingBalanceCreditCounter);

  const report = {
    status: transferResult.sig ? "REAL" : "BLOCKED",
    cluster: RPC_URL,
    mint: mintSigner.address,
    source: source.address,
    destination: dest.address,
    equalityContext: eqCtx.address,
    validityContext: valCtx.address,
    rangeContext: rangeCtx.address,
    transferSignature: transferResult.sig,
    slot: transferResult.slot,
    bytes: transferResult.bytes,
    cu: transferResult.cu,
    remainingMatchesHomomorphic: proofs.remaining_matches_homomorphic,
    mintCreate: mintTx.sig,
    negative: negResults,
    destPendingCounter: dstAfter?.pendingBalanceCreditCounter ?? null,
    note: "Destination pending is intentionally not applied (Step 7).",
  };
  mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
  writeFileSync(resolve(repoRoot, "docs/step6-result.json"), JSON.stringify(report, null, 2));
  console.log("\nSTEP 6", report.status, report.transferSignature);
  return report;
}

runStep6().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
