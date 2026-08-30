import {
  getConfidentialDepositInstruction,
  getApplyConfidentialPendingBalanceInstruction,
  TOKEN_2022_PROGRAM_ADDRESS
} from "@solana-program/token-2022";
import { AeKey, AeCiphertext } from "@solana/zk-sdk";
import {
  createRpc, createSolanaRpcApi, createDefaultRpcTransport,
  address, createKeyPairSignerFromBytes, createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions, signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction, setTransactionMessageFeePayerSigner
} from "@solana/kit";
import { readFileSync } from "fs";

async function waitConfirm(rpc: any, sig: string) {
  while (true) {
    const statuses = await rpc.getSignatureStatuses([sig]).send();
    const stat = statuses.value[0];
    if (stat && stat.confirmationStatus && (stat.confirmationStatus === 'confirmed' || stat.confirmationStatus === 'finalized')) {
      return { slot: stat.slot, status: stat.confirmationStatus };
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function sendTx(rpc: any, payer: any, ixs: any[], name: string) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  let msg = createTransactionMessage({ version: 0 });
  msg = setTransactionMessageFeePayerSigner(payer, msg);
  msg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg);
  msg = appendTransactionMessageInstructions(ixs, msg);
  const signedTx = await signTransactionMessageWithSigners(msg);
  const wire = getBase64EncodedWireTransaction(signedTx);
  const bytes = Buffer.from(wire, 'base64').length;
  const sim = await rpc.simulateTransaction(wire, { commitment: "confirmed", encoding: "base64" }).send();
  console.log(`[${name}] Sim CU: ${sim.value.unitsConsumed}, Bytes: ${bytes}, Err:`, sim.value.err);
  if (sim.value.err) {
    throw new Error(`Simulation failed for ${name}: ${JSON.stringify(sim.value.logs)}`);
  }
  const sig = await rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true }).send();
  const conf = await waitConfirm(rpc, sig);
  console.log(`[${name}] Confirmed in Slot ${conf.slot} (${conf.status}), Sig: ${sig}`);
  return { sig, slot: conf.slot, bytes, cu: sim.value.unitsConsumed };
}

async function decodeFullRawAccount(rpc: any, token: any) {
  const accountInfo = await rpc.getAccountInfo(token, { encoding: "base64" }).send();
  const rawBytes = Buffer.from(accountInfo.value!.data[0], 'base64');
  let offset = 166;
  while (offset + 4 <= rawBytes.length) {
    const extType = rawBytes.readUInt16LE(offset);
    const extLen = rawBytes.readUInt16LE(offset + 2);
    offset += 4;
    if (extType === 5) {
      const extBytes = rawBytes.subarray(offset, offset + extLen);
      return {
        approved: extBytes[0] === 1,
        elgamalPubkeyHex: extBytes.subarray(1, 33).toString('hex'),
        pendingLoHex: extBytes.subarray(33, 97).toString('hex'),
        pendingHiHex: extBytes.subarray(97, 161).toString('hex'),
        availableBalanceHex: extBytes.subarray(161, 225).toString('hex'),
        decryptableAvailableBalanceHex: extBytes.subarray(225, 261).toString('hex'),
        decryptableBytes: extBytes.subarray(225, 261),
        allowConfidentialCredits: extBytes[261] === 1,
        allowNonConfidentialCredits: extBytes[262] === 1,
        pendingCounter: extBytes.readBigUInt64LE(263),
        maxPendingCounter: extBytes.readBigUInt64LE(271),
        expectedCounter: extBytes.readBigUInt64LE(279),
        actualCounter: extBytes.readBigUInt64LE(287),
      };
    }
    offset += extLen;
  }
  throw new Error("Extension 5 not found");
}

async function runAudit() {
  const rpc = createRpc({ api: createSolanaRpcApi(), transport: createDefaultRpcTransport({ url: "https://api.devnet.solana.com" }) });
  const keypairRaw = JSON.parse(readFileSync("wsl-payer.json", "utf-8"));
  const payer = await createKeyPairSignerFromBytes(new Uint8Array(keypairRaw));

  const mint = address("6RBs6aoEpQZ59aKfpqWE2SnAX3cysBo3whFuhBoe9suT");
  const token = address("HKrZcotGz9MCJz1yLzBq4Cd6mYFViNb8iCgtY3gTRSMm");

  const seed = new Uint8Array(16).fill(99);
  const userAeKey = AeKey.fromSeed(seed);

  console.log("=== 1. CURRENT RAW ON-CHAIN STATE ===");
  const state0 = await decodeFullRawAccount(rpc, token);
  console.log("State 0 Counters:", {
    pending: state0.pendingCounter.toString(),
    expected: state0.expectedCounter.toString(),
    actual: state0.actualCounter.toString(),
  });

  // Step 1: Deposit 10,000 (Credit #1)
  console.log("\n=== 2. PERFORMING DEPOSIT 1 (10,000) ===");
  const dep1 = await sendTx(rpc, payer, [
    getConfidentialDepositInstruction({ mint, token, authority: payer, amount: 10_000n, decimals: 6 })
  ], "Deposit-1");

  const stateAfterDep1 = await decodeFullRawAccount(rpc, token);
  console.log("State After Deposit 1 -> Pending Counter:", stateAfterDep1.pendingCounter.toString());

  // Step 2: Normal ApplyPendingBalance with REAL AeCiphertext
  console.log("\n=== 3. EXECUTING NORMAL ApplyPendingBalance WITH DERIVED AeCiphertext ===");
  // We encrypt the new balance cache under the user's AeKey
  // Current available on-chain + 10,000
  const ct1 = userAeKey.encrypt(585_000n);
  const applyNormal = await sendTx(rpc, payer, [
    getApplyConfidentialPendingBalanceInstruction({
      token,
      authority: payer,
      expectedPendingBalanceCreditCounter: 1n,
      newDecryptableAvailableBalance: ct1.toBytes(),
    })
  ], "ApplyPendingBalance-Normal");

  const stateAfterApplyNormal = await decodeFullRawAccount(rpc, token);
  console.log("State After Normal Apply:", {
    pending: stateAfterApplyNormal.pendingCounter.toString(),
    expected: stateAfterApplyNormal.expectedCounter.toString(),
    actual: stateAfterApplyNormal.actualCounter.toString(),
  });
  const decryptedNormal = userAeKey.decrypt(AeCiphertext.fromBytes(stateAfterApplyNormal.decryptableBytes));
  console.log("Decrypted Available Balance Cache:", decryptedNormal.toString());
  console.log("Normal Apply Invariant (expected == actual):", stateAfterApplyNormal.expectedCounter === stateAfterApplyNormal.actualCounter);

  // Step 3: REAL RACE DRILL (Deposit 2 and Deposit 3 arrive before Apply lands)
  console.log("\n=== 4. EXECUTING REAL ON-CHAIN RACE DRILL (2 Intervening Deposits) ===");
  await sendTx(rpc, payer, [
    getConfidentialDepositInstruction({ mint, token, authority: payer, amount: 10_000n, decimals: 6 })
  ], "Deposit-2");
  await sendTx(rpc, payer, [
    getConfidentialDepositInstruction({ mint, token, authority: payer, amount: 10_000n, decimals: 6 })
  ], "Deposit-3");

  const stateAfterDep2And3 = await decodeFullRawAccount(rpc, token);
  console.log("State After Deposits 2 & 3 -> Pending Counter on-chain:", stateAfterDep2And3.pendingCounter.toString());

  // Keeper constructed Apply when it only saw 1 deposit (expected = 1n)
  const ctStale = userAeKey.encrypt(595_000n); // Stale calculation!
  console.log("Submitting Apply with STALE expectedPendingBalanceCreditCounter = 1n (Actual is 2n)...");
  const applyRaced = await sendTx(rpc, payer, [
    getApplyConfidentialPendingBalanceInstruction({
      token,
      authority: payer,
      expectedPendingBalanceCreditCounter: 1n, // Stale!
      newDecryptableAvailableBalance: ctStale.toBytes(),
    })
  ], "ApplyPendingBalance-Raced");

  const stateAfterRaced = await decodeFullRawAccount(rpc, token);
  console.log("State After Raced Apply:", {
    pending: stateAfterRaced.pendingCounter.toString(),
    expected: stateAfterRaced.expectedCounter.toString(),
    actual: stateAfterRaced.actualCounter.toString(),
  });
  console.log("Race Detected on-chain (expected != actual):", stateAfterRaced.expectedCounter !== stateAfterRaced.actualCounter);
  console.log(`expected: ${stateAfterRaced.expectedCounter}, actual: ${stateAfterRaced.actualCounter}`);

  // Step 4: Keeper Reconciliation per PLAN.md §7.4
  console.log("\n=== 5. KEEPER RECONCILIATION (PLAN.md §7.4) ===");
  // True on-chain balance is 605_000n. Keeper re-encrypts true balance with expected = 0n.
  const ctReconciled = userAeKey.encrypt(605_000n);
  const applyReconciled = await sendTx(rpc, payer, [
    getApplyConfidentialPendingBalanceInstruction({
      token,
      authority: payer,
      expectedPendingBalanceCreditCounter: 0n,
      newDecryptableAvailableBalance: ctReconciled.toBytes(),
    })
  ], "ApplyPendingBalance-Reconciliation");

  const finalState = await decodeFullRawAccount(rpc, token);
  console.log("\n=== 6. FINAL DECODED ON-CHAIN STATE ===");
  console.log({
    approved: finalState.approved,
    allowConfidentialCredits: finalState.allowConfidentialCredits,
    allowNonConfidentialCredits: finalState.allowNonConfidentialCredits,
    pendingCounter: finalState.pendingCounter.toString(),
    expectedCounter: finalState.expectedCounter.toString(),
    actualCounter: finalState.actualCounter.toString(),
    decryptableAvailableBalanceHex: finalState.decryptableAvailableBalanceHex,
  });
  const finalDecrypted = userAeKey.decrypt(AeCiphertext.fromBytes(finalState.decryptableBytes));
  console.log("Final Decrypted Available Balance:", finalDecrypted.toString());
}
runAudit().catch(console.error);
