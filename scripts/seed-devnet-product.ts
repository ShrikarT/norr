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
  generateKeyPairSigner,
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
  launch: address(rawIds.norr_launch),
  market: address(rawIds.norr_market),
  fees: address(rawIds.norr_fees),
  boards: address(rawIds.norr_boards),
  social: address(rawIds.norr_social),
  claim: address(rawIds.norr_claim),
  wrap: address(rawIds.norr_wrap),
};

const SYSTEM_PROGRAM = address("11111111111111111111111111111111");

function getAnchorDiscriminator(name: string): Uint8Array {
  return sha256(new TextEncoder().encode(`global:${name}`)).subarray(0, 8);
}

function u16le(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
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

function i64le(n: bigint | number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, BigInt(n), true);
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

async function derivePda(program: string, seeds: (Uint8Array | string)[]): Promise<[string, number]> {
  const seedBytes = seeds.map((s) => (typeof s === "string" ? utf8(s) : s));
  const [derivedAddress, bump] = await getProgramDerivedAddress({
    programAddress: address(program),
    seeds: seedBytes,
  });
  return [derivedAddress, bump];
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
  console.log("=== Norr Devnet Product Seeding & Verification ===");
  const rawKey = JSON.parse(readFileSync(resolve(process.env.HOME || "/root", ".config/solana/id.json"), "utf8"));
  const payer = await createKeyPairSignerFromBytes(new Uint8Array(rawKey));
  console.log("Deployer / Payer:", payer.address);

  const payerBytes = pubkeyBytes(payer.address);
  const stateResults: Record<string, any> = {};

  // 1. Create Curation Desk / Board
  const slug = `defi-${Date.now().toString().slice(-6)}`;
  console.log(`\n[1/5] Creating Curation Desk "${slug}" on norr_boards...`);
  const [boardAddress] = await derivePda(PROGRAM_IDS.boards, ["board", slug]);
  const slugBytes = utf8(slug);
  const boardNameBytes = utf8("Solana DeFi Desk");
  const boardUriBytes = utf8("https://norr.io/desk/defi");

  const createBoardIx = {
    programAddress: PROGRAM_IDS.boards,
    accounts: [
      { address: payer.address, role: 3 }, // Signer, Writable
      { address: address(boardAddress), role: 1 }, // Writable
      { address: SYSTEM_PROGRAM, role: 0 }, // Readonly
    ],
    data: concat(
      getAnchorDiscriminator("create_board"),
      u32le(slugBytes.length), slugBytes,
      u32le(boardNameBytes.length), boardNameBytes,
      u32le(boardUriBytes.length), boardUriBytes,
      u16le(250), // min_bps (2.5%)
      new Uint8Array([0]) // allowlist_only = false
    ),
  };
  const boardTx = await sendTx(payer, [createBoardIx]);
  console.log(`✓ Board created at ${boardAddress}: Tx=${boardTx.signature} (slot ${boardTx.slot}, CU=${boardTx.cu})`);
  stateResults.board = { address: boardAddress, slug, tx: boardTx.signature, slot: boardTx.slot };

  // 2. Initialize Discussion Thread & Profile on norr_social
  console.log(`\n[2/5] Creating Social Profile & Thread on norr_social...`);
  const [profileAddress] = await derivePda(PROGRAM_IDS.social, ["profile", payerBytes]);
  const createProfileIx = {
    programAddress: PROGRAM_IDS.social,
    accounts: [
      { address: payer.address, role: 3 },
      { address: address(profileAddress), role: 1 },
      { address: SYSTEM_PROGRAM, role: 0 },
    ],
    data: getAnchorDiscriminator("create_profile"),
  };
  const profileTx = await sendTx(payer, [createProfileIx]);
  console.log(`✓ Social Profile created at ${profileAddress}: Tx=${profileTx.signature}`);

  const [threadAddress] = await derivePda(PROGRAM_IDS.social, ["thread", pubkeyBytes(boardAddress)]);
  const initThreadIx = {
    programAddress: PROGRAM_IDS.social,
    accounts: [
      { address: payer.address, role: 3 },
      { address: address(boardAddress), role: 0 },
      { address: address(threadAddress), role: 1 },
      { address: SYSTEM_PROGRAM, role: 0 },
    ],
    data: getAnchorDiscriminator("initialize_thread"),
  };
  const threadTx = await sendTx(payer, [initThreadIx]);
  console.log(`✓ Discussion Thread initialized at ${threadAddress}: Tx=${threadTx.signature}`);

  const [commentAddress] = await derivePda(PROGRAM_IDS.social, ["comment", pubkeyBytes(boardAddress), u32le(0)]);
  const commentBytes = utf8("Official coordination thread for Norr on Solana Devnet.");
  const postCommentIx = {
    programAddress: PROGRAM_IDS.social,
    accounts: [
      { address: payer.address, role: 3 },
      { address: address(threadAddress), role: 1 },
      { address: address(commentAddress), role: 1 },
      { address: address(profileAddress), role: 1 },
      { address: SYSTEM_PROGRAM, role: 0 },
    ],
    data: concat(
      getAnchorDiscriminator("post"),
      u32le(0xFFFFFFFF), // parent_index = u32::MAX (root comment)
      u32le(commentBytes.length), commentBytes
    ),
  };
  const commentTx = await sendTx(payer, [postCommentIx]);
  console.log(`✓ On-chain Comment posted at ${commentAddress}: Tx=${commentTx.signature}`);
  stateResults.social = { thread: threadAddress, comment: commentAddress, profile: profileAddress, tx: commentTx.signature };

  // 3. Create Fee Router on norr_fees
  console.log(`\n[3/5] Initializing Fee Router on norr_fees...`);
  const projectMintKeypair = await generateKeyPairSigner();
  const [launchAddress] = await derivePda(PROGRAM_IDS.launch, ["launch", pubkeyBytes(projectMintKeypair.address)]);
  const [routerAddress] = await derivePda(PROGRAM_IDS.fees, ["router", pubkeyBytes(launchAddress)]);

  const initFeesIx = {
    programAddress: PROGRAM_IDS.fees,
    accounts: [
      { address: payer.address, role: 3 },
      { address: address(launchAddress), role: 0 },
      { address: payer.address, role: 0 }, // asset_mint placeholder / token
      { address: payer.address, role: 0 }, // vault placeholder
      { address: address(routerAddress), role: 1 },
      { address: SYSTEM_PROGRAM, role: 0 },
    ],
    data: concat(
      getAnchorDiscriminator("initialize"),
      u32le(1), // 1 split input
      payerBytes, // recipient
      u16le(10000), // 100% (10,000 bps)
      new Uint8Array([0]) // category 0
    ),
  };
  const feesTx = await sendTx(payer, [initFeesIx]);
  console.log(`✓ Fee Router initialized at ${routerAddress}: Tx=${feesTx.signature}`);
  stateResults.fees = { router: routerAddress, tx: feesTx.signature };

  // 4. Create Launch on norr_launch
  console.log(`\n[4/5] Creating Token Launch on norr_launch...`);
  const [saleAddress] = await derivePda(PROGRAM_IDS.claim, ["sale", pubkeyBytes(launchAddress)]);
  const [curveAddress] = await derivePda(PROGRAM_IDS.market, ["curve", pubkeyBytes(projectMintKeypair.address)]);

  const launchNameBytes = utf8("Norr Protocol Token");
  const launchSymbolBytes = utf8("NORR");
  const launchUriBytes = utf8("https://norr.io/token.json");

  const createLaunchIx = {
    programAddress: PROGRAM_IDS.launch,
    accounts: [
      { address: payer.address, role: 3 },
      { address: address(launchAddress), role: 1 },
      { address: SYSTEM_PROGRAM, role: 0 },
    ],
    data: concat(
      getAnchorDiscriminator("create"),
      // CreateArgs:
      pubkeyBytes(projectMintKeypair.address),
      payerBytes, // contribution_mint
      pubkeyBytes(saleAddress),
      pubkeyBytes(routerAddress),
      pubkeyBytes(curveAddress),
      new Uint8Array([0]), // model: 0 (instant)
      new Uint8Array(32), // metadata_hash
      u32le(launchNameBytes.length), launchNameBytes,
      u32le(launchSymbolBytes.length), launchSymbolBytes,
      u32le(launchUriBytes.length), launchUriBytes
    ),
  };
  const launchTx = await sendTx(payer, [createLaunchIx]);
  console.log(`✓ Launch created at ${launchAddress}: Tx=${launchTx.signature}`);
  stateResults.launch = { address: launchAddress, projectMint: projectMintKeypair.address, tx: launchTx.signature };

  // 5. Initialize Sale & Merkle Claim on norr_claim
  console.log(`\n[5/5] Initializing Sale & Settlement Claim on norr_claim...`);
  const now = Math.floor(Date.now() / 1000);
  const initSaleIx = {
    programAddress: PROGRAM_IDS.claim,
    accounts: [
      { address: payer.address, role: 3 },
      { address: address(launchAddress), role: 0 },
      { address: address(saleAddress), role: 1 },
      { address: SYSTEM_PROGRAM, role: 0 },
    ],
    data: concat(
      getAnchorDiscriminator("initialize"),
      pubkeyBytes(projectMintKeypair.address),
      payerBytes, // contribution_mint
      pubkeyBytes(routerAddress),
      payerBytes, // wrap_config
      payerBytes, // settlement_mint
      i64le(now - 3600), // starts_at
      i64le(now + 86400), // ends_at
      payerBytes, // tally_authority
      payerBytes // emergency_authority
    ),
  };
  const saleTx = await sendTx(payer, [initSaleIx]);
  console.log(`✓ Sale initialized at ${saleAddress}: Tx=${saleTx.signature}`);

  // Build Merkle Tree for claim
  const allocation = 50_000n;
  const leaf = allocationLeaf({
    programId: PROGRAM_IDS.claim,
    sale: saleAddress,
    projectMint: projectMintKeypair.address,
    claimant: payer.address,
    allocation,
  });
  const dummyLeaf = new Uint8Array(32);
  const tree = new MerkleTree([leaf, dummyLeaf]);

  const finalizeIx = {
    programAddress: PROGRAM_IDS.claim,
    accounts: [
      { address: payer.address, role: 3 }, // tally_authority
      { address: address(saleAddress), role: 1 },
    ],
    data: concat(
      getAnchorDiscriminator("finalize"),
      tree.root, // root
      new Uint8Array(32), // manifest_hash
      new Uint8Array(32), // chain_hash
      u32le(1), // count
      u64le(100_000n), // total_contributed
      u64le(50_000n), // total_allocated
      u32le(1) // claimant_count
    ),
  };
  const finalizeTx = await sendTx(payer, [finalizeIx]);
  console.log(`✓ Sale finalized with Merkle Root on norr_claim: Tx=${finalizeTx.signature}`);

  stateResults.claim = {
    sale: saleAddress,
    merkleRoot: Buffer.from(tree.root).toString("hex"),
    initTx: saleTx.signature,
    finalizeTx: finalizeTx.signature,
  };

  writeFileSync(resolve(repoRoot, "docs/devnet-product-state.json"), JSON.stringify(stateResults, null, 2));
  console.log("\n=== ALL DEVNET PRODUCT OBJECTS SUCCESSFULLY CREATED & VERIFIED ===");
  console.log("State written to docs/devnet-product-state.json");
}

main().catch(console.error);
