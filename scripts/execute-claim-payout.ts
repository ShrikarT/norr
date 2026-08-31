import {
  createRpc,
  createSolanaRpcApi,
  createDefaultRpcTransport,
  address,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  setTransactionMessageFeePayerSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
} from "@solana/kit";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { sha256 } from "@noble/hashes/sha2.js";
import { MerkleTree, allocationLeaf } from "@norr/sdk";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const RPC_URL = process.env.NORR_RPC ?? "https://api.devnet.solana.com";

const rpc = createRpc({
  api: createSolanaRpcApi(),
  transport: createDefaultRpcTransport({ url: RPC_URL }),
});

const rawIds: Record<string, string> = JSON.parse(readFileSync(resolve(repoRoot, "program-ids.json"), "utf8"));
const PROGRAM_IDS = {
  claim: address(rawIds.norr_claim),
  launch: address(rawIds.norr_launch),
};

const SYSTEM_PROGRAM = address("11111111111111111111111111111111");

function getAnchorDiscriminator(name: string): Uint8Array {
  return sha256(new TextEncoder().encode(`global:${name}`)).subarray(0, 8);
}

function u32le(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function u64le(n: bigint | number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n), true);
  return b;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function pubkeyBytes(addr: string): Uint8Array {
  return new Uint8Array(getAddressEncoder().encode(address(addr)));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, curr) => acc + curr.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

async function sendTx(payerSigner: any, instructions: any[]) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  let msg = createTransactionMessage({ version: 0 });
  msg = setTransactionMessageFeePayerSigner(payerSigner, msg);
  msg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg);
  msg = appendTransactionMessageInstructions(instructions, msg);

  const signed = await signTransactionMessageWithSigners(msg);
  const wire = getBase64EncodedWireTransaction(signed);

  const sig = await rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" }).send();

  let confirmed = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await rpc.getSignatureStatuses([sig]).send();
    const s = status.value[0];
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) {
      if (s.err) throw new Error(`Transaction ${sig} failed: ${JSON.stringify(s.err)}`);
      confirmed = true;
      break;
    }
  }
  if (!confirmed) throw new Error(`Transaction ${sig} did not confirm in time`);
  const txInfo = await rpc.getTransaction(sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }).send();
  return { signature: sig, slot: txInfo?.slot, cu: txInfo?.meta?.computeUnitsConsumed };
}

async function main() {
  console.log("=== Norr Claim & Settlement Drill on Devnet ===");
  const rawKey = JSON.parse(readFileSync(resolve(process.env.HOME || "/root", ".config/solana/id.json"), "utf8"));
  const payer = await createKeyPairSignerFromBytes(new Uint8Array(rawKey));

  const devnetState = JSON.parse(readFileSync(resolve(repoRoot, "docs/devnet-product-state.json"), "utf8"));
  const saleAddress = devnetState.claim.sale;
  const projectMint = devnetState.launch.projectMint;

  console.log("Sale Account:", saleAddress);
  console.log("Project Mint:", projectMint);
  console.log("Claimant:", payer.address);

  const allocation = 50_000n;
  const leaf = allocationLeaf({
    programId: rawIds.norr_claim,
    sale: saleAddress,
    projectMint,
    claimant: payer.address,
    allocation,
  });
  const dummyLeaf = new Uint8Array(32);
  const tree = new MerkleTree([leaf, dummyLeaf]);
  const proof = tree.proof(0);

  const [claimStatusAddress] = await getProgramDerivedAddress({
    programAddress: PROGRAM_IDS.claim,
    seeds: [utf8("claim"), pubkeyBytes(saleAddress), pubkeyBytes(payer.address)],
  });

  console.log(`Claim Status PDA: ${claimStatusAddress}`);

  // Build open_claim instruction data:
  // discriminator (8B) + allocation (8B) + proof vec (4B count + N*32B)
  const proofData = new Uint8Array(4 + proof.length * 32);
  new DataView(proofData.buffer).setUint32(0, proof.length, true);
  proof.forEach((p, idx) => {
    proofData.set(p, 4 + idx * 32);
  });

  const openClaimIx = {
    programAddress: PROGRAM_IDS.claim,
    accounts: [
      { address: payer.address, role: 3 }, // claimant [signer, writable]
      { address: address(saleAddress), role: 0 }, // sale [readonly]
      { address: address(claimStatusAddress), role: 1 }, // claim_status [writable, init]
      { address: SYSTEM_PROGRAM, role: 0 }, // system_program
    ],
    data: concat(
      getAnchorDiscriminator("open_claim"),
      u64le(allocation),
      proofData
    ),
  };

  console.log("Simulating and sending open_claim...");
  try {
    const tx = await sendTx(payer, [openClaimIx]);
    console.log(`✓ open_claim confirmed on Devnet: Tx=${tx.signature} (slot ${tx.slot}, CU=${tx.cu})`);
    devnetState.claim.openClaimTx = tx.signature;
    writeFileSync(resolve(repoRoot, "docs/devnet-product-state.json"), JSON.stringify(devnetState, null, 2));
  } catch (err: any) {
    console.log("open_claim result:", err.message);
  }
}

main().catch(console.error);
