import {
  getApplyConfidentialPendingBalanceInstruction,
  TOKEN_2022_PROGRAM_ADDRESS
} from "@solana-program/token-2022";
import {
  createRpc, createSolanaRpcApi, createDefaultRpcTransport,
  address, createKeyPairSignerFromBytes, createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions, signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction, setTransactionMessageFeePayerSigner,
  generateKeyPairSigner
} from "@solana/kit";
import { readFileSync } from "fs";

async function run() {
  const rpc = createRpc({ api: createSolanaRpcApi(), transport: createDefaultRpcTransport({ url: "https://api.devnet.solana.com" }) });
  const keypairRaw = JSON.parse(readFileSync("wsl-payer.json", "utf-8"));
  const payer = await createKeyPairSignerFromBytes(new Uint8Array(keypairRaw));

  const mint = address("6RBs6aoEpQZ59aKfpqWE2SnAX3cysBo3whFuhBoe9suT");
  const token = address("HKrZcotGz9MCJz1yLzBq4Cd6mYFViNb8iCgtY3gTRSMm");

  console.log("=== STEP 5: PRE-CONDITION CHECKS ===");
  const accountInfoBefore = await rpc.getAccountInfo(token, { encoding: "jsonParsed" }).send();
  if (!accountInfoBefore.value) {
    throw new Error("Account does not exist on Devnet!");
  }
  console.log("Account Program Owner:", accountInfoBefore.value.owner);
  if (accountInfoBefore.value.owner !== TOKEN_2022_PROGRAM_ADDRESS) {
    throw new Error(`Owner mismatch! Expected ${TOKEN_2022_PROGRAM_ADDRESS}, got ${accountInfoBefore.value.owner}`);
  }

  const parsedBefore = accountInfoBefore.value.data.parsed.info;
  console.log("Parsed Mint:", parsedBefore.mint);
  console.log("Parsed Owner:", parsedBefore.owner);
  if (parsedBefore.mint !== mint) {
    throw new Error(`Mint mismatch! Expected ${mint}, got ${parsedBefore.mint}`);
  }
  if (parsedBefore.owner !== payer.address) {
    throw new Error(`Authority mismatch! Expected ${payer.address}, got ${parsedBefore.owner}`);
  }

  const ctExtBefore = parsedBefore.extensions.find((e: any) => e.extension === 'confidentialTransferAccount');
  if (!ctExtBefore) {
    throw new Error("ConfidentialTransferAccount extension not found on account!");
  }
  console.log("Pending Credit Counter Before:", ctExtBefore.state.pendingBalanceCreditCounter);
  console.log("Expected Pending Credit Counter Before:", ctExtBefore.state.expectedPendingBalanceCreditCounter);
  console.log("Actual Pending Credit Counter Before:", ctExtBefore.state.actualPendingBalanceCreditCounter);
  console.log("Available Balance Before (base64):", ctExtBefore.state.availableBalance);
  console.log("Pending Balance Hi Before (base64):", ctExtBefore.state.pendingBalanceHi);
  console.log("Pending Balance Lo Before (base64):", ctExtBefore.state.pendingBalanceLo);

  if (ctExtBefore.state.pendingBalanceCreditCounter !== 1n) {
    throw new Error(`Expected pendingBalanceCreditCounter === 1n, got ${ctExtBefore.state.pendingBalanceCreditCounter}`);
  }

  console.log("\n=== CONSTRUCTING INSTRUCTION & NEGATIVE TESTS ===");
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();

  // Negative test: Wrong authority
  const fakeSigner = await generateKeyPairSigner();
  const ixWrongAuth = getApplyConfidentialPendingBalanceInstruction({
    token,
    authority: fakeSigner,
    expectedPendingBalanceCreditCounter: 1n,
    newDecryptableAvailableBalance: new Uint8Array(36),
  });
  let msgWrong = createTransactionMessage({ version: 0 });
  msgWrong = setTransactionMessageFeePayerSigner(payer, msgWrong);
  msgWrong = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msgWrong);
  msgWrong = appendTransactionMessageInstructions([ixWrongAuth], msgWrong);
  const signedWrong = await signTransactionMessageWithSigners(msgWrong);
  const simWrong = await rpc.simulateTransaction(getBase64EncodedWireTransaction(signedWrong), { commitment: "confirmed", encoding: "base64" }).send();
  console.log("[Negative Test: Wrong Authority] Err:", simWrong.value.err, "Logs:", simWrong.value.logs);

  // Real instruction with expectedPendingBalanceCreditCounter = 1n
  const ixApply = getApplyConfidentialPendingBalanceInstruction({
    token,
    authority: payer,
    expectedPendingBalanceCreditCounter: 1n,
    newDecryptableAvailableBalance: new Uint8Array(36),
  });

  let msg = createTransactionMessage({ version: 0 });
  msg = setTransactionMessageFeePayerSigner(payer, msg);
  msg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg);
  msg = appendTransactionMessageInstructions([ixApply], msg);

  const signedTx = await signTransactionMessageWithSigners(msg);
  const wire = getBase64EncodedWireTransaction(signedTx);
  const txBytes = Buffer.from(wire, 'base64').length;
  console.log("\nSerialized Transaction Size:", txBytes, "bytes (Limit: 1232)");

  const startTime = Date.now();
  const sim = await rpc.simulateTransaction(wire, { commitment: "confirmed", encoding: "base64" }).send();
  const simLatency = Date.now() - startTime;
  console.log("Simulation CU Consumed:", sim.value.unitsConsumed, "(Limit: 1,400,000)");
  console.log("Simulation Latency:", simLatency, "ms");
  console.log("Simulation Err:", sim.value.err);

  if (sim.value.err) {
    console.error("Simulation failed! Logs:", sim.value.logs);
    return;
  }

  console.log("\n=== SUBMITTING REAL DEVNET TRANSACTION ===");
  const submitStart = Date.now();
  const sig = await rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true }).send();
  console.log("Transaction Signature:", sig);

  console.log("Waiting for confirmation at confirmed commitment...");
  let confirmedSlot: bigint | null = null;
  while (true) {
    const statuses = await rpc.getSignatureStatuses([sig]).send();
    const stat = statuses.value[0];
    if (stat && stat.confirmationStatus && (stat.confirmationStatus === 'confirmed' || stat.confirmationStatus === 'finalized')) {
      confirmedSlot = stat.slot;
      console.log(`Confirmed in Slot ${confirmedSlot} with status ${stat.confirmationStatus}`);
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  const totalLatency = Date.now() - submitStart;
  console.log("Total Confirmation Latency:", totalLatency, "ms");

  console.log("\n=== STEP 5: POST-CONDITION VERIFICATION ===");
  const accountInfoAfter = await rpc.getAccountInfo(token, { encoding: "jsonParsed" }).send();
  const parsedAfter = accountInfoAfter.value.data.parsed.info;
  const ctExtAfter = parsedAfter.extensions.find((e: any) => e.extension === 'confidentialTransferAccount');

  console.log("Pending Credit Counter After:", ctExtAfter.state.pendingBalanceCreditCounter);
  console.log("Expected Pending Credit Counter After:", ctExtAfter.state.expectedPendingBalanceCreditCounter);
  console.log("Actual Pending Credit Counter After:", ctExtAfter.state.actualPendingBalanceCreditCounter);
  console.log("Available Balance After (base64):", ctExtAfter.state.availableBalance);
  console.log("Pending Balance Hi After (base64):", ctExtAfter.state.pendingBalanceHi);
  console.log("Pending Balance Lo After (base64):", ctExtAfter.state.pendingBalanceLo);
  console.log("Public Balance After:", parsedAfter.tokenAmount.amount);

  // Assertions
  if (ctExtAfter.state.pendingBalanceCreditCounter !== 0n) {
    throw new Error(`Postcondition failed: pendingBalanceCreditCounter !== 0n (${ctExtAfter.state.pendingBalanceCreditCounter})`);
  }
  if (ctExtAfter.state.expectedPendingBalanceCreditCounter !== 1n) {
    throw new Error(`Postcondition failed: expectedPendingBalanceCreditCounter !== 1n (${ctExtAfter.state.expectedPendingBalanceCreditCounter})`);
  }
  if (ctExtAfter.state.actualPendingBalanceCreditCounter !== 1n) {
    throw new Error(`Postcondition failed: actualPendingBalanceCreditCounter !== 1n (${ctExtAfter.state.actualPendingBalanceCreditCounter})`);
  }
  console.log("\n=== STEP 5 DEVNET EXECUTION COMPLETED SUCCESSFULLY! ===");
}
run().catch(err => {
  console.error("Step 5 execution failed:", err);
  process.exit(1);
});
