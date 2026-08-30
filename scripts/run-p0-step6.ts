import {
  getInitializeAccountInstruction,
  getReallocateInstructionDataEncoder,
  getConfigureConfidentialTransferAccountInstructionDataEncoder,
  getEnableConfidentialCreditsInstruction,
  getEnableNonConfidentialCreditsInstruction,
  getMintToInstruction,
  getConfidentialDepositInstruction,
  getApplyConfidentialPendingBalanceInstruction,
  getConfidentialTransferInstructionDataEncoder,
  TOKEN_2022_PROGRAM_ADDRESS
} from "@solana-program/token-2022";
import {
  ElGamalKeypair,
  ElGamalPubkey,
  PedersenCommitment,
  PedersenOpening,
  CiphertextCommitmentEqualityProofData,
  BatchedGroupedCiphertext3HandlesValidityProofData,
  BatchedRangeProofU128Data,
  GroupedElGamalCiphertext3Handles,
  PubkeyValidityProofData,
  AeKey,
  AeCiphertext
} from "@solana/zk-sdk";
import {
  getVerifyProofInstruction,
  CIPHERTEXT_COMMITMENT_EQUALITY_CONTEXT_ACCOUNT_SIZE,
  BATCHED_GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_CONTEXT_ACCOUNT_SIZE,
  BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE
} from "@solana-program/zk-elgamal-proof";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  createRpc, createSolanaRpcApi, createDefaultRpcTransport,
  address, createKeyPairSignerFromBytes, createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions, signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction, setTransactionMessageFeePayerSigner,
  generateKeyPairSigner
} from "@solana/kit";
import { readFileSync } from "fs";
import bs58 from "bs58";

async function waitConfirm(rpc: any, sig: string) {
  for (let i = 0; i < 40; i++) {
    try {
      const statuses = await rpc.getSignatureStatuses([sig]).send();
      const stat = statuses.value[0];
      if (stat && stat.confirmationStatus && (stat.confirmationStatus === 'confirmed' || stat.confirmationStatus === 'finalized')) {
        return { slot: stat.slot, status: stat.confirmationStatus };
      }
    } catch (e: any) {
      // transient RPC error
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Confirmation timed out for ${sig}`);
}

async function sendTx(rpc: any, payer: any, signers: any[], ixs: any[], name: string) {
  let latestBlockhash: any;
  while (true) {
    try {
      const res = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
      latestBlockhash = res.value;
      break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  let msg = createTransactionMessage({ version: 0 });
  msg = setTransactionMessageFeePayerSigner(payer, msg);
  msg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg);
  msg = appendTransactionMessageInstructions(ixs, msg);
  const signedTx = await signTransactionMessageWithSigners(msg);
  const wire = getBase64EncodedWireTransaction(signedTx);
  const bytes = Buffer.from(wire, 'base64').length;

  let sim: any;
  while (true) {
    try {
      sim = await rpc.simulateTransaction(wire, { commitment: "confirmed", encoding: "base64" }).send();
      break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log(`[${name}] Sim CU: ${sim.value.unitsConsumed}, Bytes: ${bytes}, Err:`, sim.value.err);
  if (sim.value.err) {
    throw new Error(`Simulation failed for ${name}: ${JSON.stringify(sim.value.logs)}`);
  }

  const startTime = Date.now();
  let sig: string;
  while (true) {
    try {
      sig = await rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true }).send();
      break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  const conf = await waitConfirm(rpc, sig);
  const latency = Date.now() - startTime;
  console.log(`[${name}] Confirmed in Slot ${conf.slot} (${conf.status}), Latency: ${latency}ms, Sig: ${sig}`);
  return { sig, slot: conf.slot, bytes, cu: sim.value.unitsConsumed, latency };
}

async function decodeFullRawAccount(rpc: any, tokenAddress: any) {
  while (true) {
    try {
      const accountInfo = await rpc.getAccountInfo(tokenAddress, { commitment: "confirmed", encoding: "base64" }).send();
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
    } catch (e: any) {
      if (e.message && e.message.includes("Extension 5 not found")) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function runStep6() {
  const rpc = createRpc({ api: createSolanaRpcApi(), transport: createDefaultRpcTransport({ url: "https://api.devnet.solana.com" }) });
  const keypairRaw = JSON.parse(readFileSync("wsl-payer.json", "utf-8"));
  const payer = await createKeyPairSignerFromBytes(new Uint8Array(keypairRaw));

  const mint = address("6RBs6aoEpQZ59aKfpqWE2SnAX3cysBo3whFuhBoe9suT");
  const auditorPubkeyB58 = "FbcHANHTBJKZ153AwhNYD2ZWihFHT2hiYWdiiiHFoyxq";
  const auditorPubkey = ElGamalPubkey.fromBytes(bs58.decode(auditorPubkeyB58));

  console.log("=== PHASE 3 STEP 6: REAL CONFIDENTIAL TRANSFER ON DEVNET ===");
  console.log("Payer:", payer.address);
  console.log("Mint:", mint);
  console.log("Auditor Pubkey:", auditorPubkeyB58);

  // Keypairs for Source and Destination
  const srcElGamalKp = new ElGamalKeypair();
  const destElGamalKp = new ElGamalKeypair();
  const srcAeKey = AeKey.fromSeed(new Uint8Array(16).fill(77));
  const destAeKey = AeKey.fromSeed(new Uint8Array(16).fill(88));

  const sourceAccountKp = await generateKeyPairSigner();
  const destAccountKp = await generateKeyPairSigner();

  console.log("\nSource Token Account:", sourceAccountKp.address);
  console.log("Destination Token Account:", destAccountKp.address);

  // -------------------------------------------------------------
  // 1. CREATE & CONFIGURE DESTINATION ACCOUNT
  // -------------------------------------------------------------
  console.log("\n--- 1. Creating and Configuring Destination Account ---");
  const rentDest = await rpc.getMinimumBalanceForRentExemption(469n, { commitment: "confirmed" }).send();
  const ixCreateDest = getCreateAccountInstruction({
    payer, newAccount: destAccountKp, lamports: rentDest, space: 469n, programAddress: TOKEN_2022_PROGRAM_ADDRESS
  });
  const ixInitDest = getInitializeAccountInstruction({
    account: destAccountKp.address, mint, owner: payer.address
  });
  const reallocDestData = getReallocateInstructionDataEncoder().encode({ newExtensionTypes: [7, 5] });
  const ixReallocDest = {
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    accounts: [
      { address: destAccountKp.address, role: 1 },
      { address: payer.address, role: 3, signer: payer },
      { address: address("11111111111111111111111111111111"), role: 0 },
      { address: payer.address, role: 2, signer: payer },
    ],
    data: reallocDestData,
  };
  const destPubkeyProof = new PubkeyValidityProofData(destElGamalKp);
  const ixVerifyDestPubkey = getVerifyProofInstruction({
    discriminator: 4, proofData: destPubkeyProof.toBytes()
  });
  const configDestData = getConfigureConfidentialTransferAccountInstructionDataEncoder().encode({
    decryptableZeroBalance: destAeKey.encrypt(0n).toBytes(),
    maximumPendingBalanceCreditCounter: 65536n,
    proofInstructionOffset: -1,
  });
  const ixConfigDest = {
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    accounts: [
      { address: destAccountKp.address, role: 1 },
      { address: mint, role: 0 },
      { address: address("Sysvar1nstructions1111111111111111111111111"), role: 0 },
      { address: payer.address, role: 2, signer: payer },
    ],
    data: configDestData,
  };
  const ixEnableDestCredits = getEnableConfidentialCreditsInstruction({
    token: destAccountKp.address, authority: payer
  });

  await sendTx(rpc, payer, [payer, destAccountKp], [
    ixCreateDest, ixInitDest, ixReallocDest, ixVerifyDestPubkey, ixConfigDest, ixEnableDestCredits
  ], "Create-And-Configure-DestAccount");

  const destStateBefore = await decodeFullRawAccount(rpc, destAccountKp.address);
  console.log("Dest Account Verified On-Chain:", {
    approved: destStateBefore.approved,
    allowConfidentialCredits: destStateBefore.allowConfidentialCredits,
    pendingCounter: destStateBefore.pendingCounter.toString(),
  });

  // -------------------------------------------------------------
  // 2. CREATE, CONFIGURE & FUND SOURCE ACCOUNT
  // -------------------------------------------------------------
  console.log("\n--- 2. Creating, Configuring & Funding Source Account ---");
  const rentSrc = await rpc.getMinimumBalanceForRentExemption(469n, { commitment: "confirmed" }).send();
  const ixCreateSrc = getCreateAccountInstruction({
    payer, newAccount: sourceAccountKp, lamports: rentSrc, space: 469n, programAddress: TOKEN_2022_PROGRAM_ADDRESS
  });
  const ixInitSrc = getInitializeAccountInstruction({
    account: sourceAccountKp.address, mint, owner: payer.address
  });
  const reallocSrcData = getReallocateInstructionDataEncoder().encode({ newExtensionTypes: [7, 5] });
  const ixReallocSrc = {
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    accounts: [
      { address: sourceAccountKp.address, role: 1 },
      { address: payer.address, role: 3, signer: payer },
      { address: address("11111111111111111111111111111111"), role: 0 },
      { address: payer.address, role: 2, signer: payer },
    ],
    data: reallocSrcData,
  };
  const srcPubkeyProof = new PubkeyValidityProofData(srcElGamalKp);
  const ixVerifySrcPubkey = getVerifyProofInstruction({
    discriminator: 4, proofData: srcPubkeyProof.toBytes()
  });
  const configSrcData = getConfigureConfidentialTransferAccountInstructionDataEncoder().encode({
    decryptableZeroBalance: srcAeKey.encrypt(0n).toBytes(),
    maximumPendingBalanceCreditCounter: 65536n,
    proofInstructionOffset: -1,
  });
  const ixConfigSrc = {
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    accounts: [
      { address: sourceAccountKp.address, role: 1 },
      { address: mint, role: 0 },
      { address: address("Sysvar1nstructions1111111111111111111111111"), role: 0 },
      { address: payer.address, role: 2, signer: payer },
    ],
    data: configSrcData,
  };
  const ixEnableSrcConf = getEnableConfidentialCreditsInstruction({
    token: sourceAccountKp.address, authority: payer
  });
  const ixEnableSrcNonConf = getEnableNonConfidentialCreditsInstruction({
    token: sourceAccountKp.address, authority: payer
  });
  const ixMintToSrc = getMintToInstruction({
    mint, token: sourceAccountKp.address, mintAuthority: payer, amount: 50_000n
  });
  const ixDepositSrc = getConfidentialDepositInstruction({
    mint, token: sourceAccountKp.address, authority: payer, amount: 50_000n, decimals: 6
  });
  const ixApplySrc = getApplyConfidentialPendingBalanceInstruction({
    token: sourceAccountKp.address, authority: payer, expectedPendingBalanceCreditCounter: 1n,
    newDecryptableAvailableBalance: srcAeKey.encrypt(50_000n).toBytes()
  });

  await sendTx(rpc, payer, [payer, sourceAccountKp], [
    ixCreateSrc, ixInitSrc, ixReallocSrc, ixVerifySrcPubkey, ixConfigSrc, ixEnableSrcConf, ixEnableSrcNonConf,
    ixMintToSrc, ixDepositSrc, ixApplySrc
  ], "Setup-And-Fund-SourceAccount");

  const srcStateBefore = await decodeFullRawAccount(rpc, sourceAccountKp.address);
  console.log("Source Account Initial Confidential Balance Decrypted:", srcAeKey.decrypt(AeCiphertext.fromBytes(srcStateBefore.decryptableBytes)).toString());

  // -------------------------------------------------------------
  // 3. GENERATE TRANSFER PROOFS (Transfer 10,000; Remaining 40,000)
  // -------------------------------------------------------------
  console.log("\n--- 3. Generating Transfer Proofs ---");
  const transferAmount = 10_000n;
  const remainingAmount = 40_000n;
  const amountLo = 10_000n;
  const amountHi = 0n;

  const openLo = new PedersenOpening();
  const openHi = new PedersenOpening();
  const openPad = new PedersenOpening();

  // Source Available Balance Opening before transfer is 0 because it came from deposit
  // So opening for remaining balance is 0 - (openLo + 2^16 * openHi) = -openTransfer
  const openTransfer = PedersenOpening.combineLoHi(openLo, openHi, 16);
  const openRemaining = PedersenOpening.zero().subtract(openTransfer);

  const commitRemaining = PedersenCommitment.from(remainingAmount, openRemaining);
  const commitLo = PedersenCommitment.from(amountLo, openLo);
  const commitHi = PedersenCommitment.from(amountHi, openHi);
  const commitPad = PedersenCommitment.from(0n, openPad);

  const ctRemaining = srcElGamalKp.pubkey().encryptWith(remainingAmount, openRemaining);
  const groupedCtLo = GroupedElGamalCiphertext3Handles.encryptWith(srcElGamalKp.pubkey(), destElGamalKp.pubkey(), auditorPubkey, amountLo, openLo);
  const groupedCtHi = GroupedElGamalCiphertext3Handles.encryptWith(srcElGamalKp.pubkey(), destElGamalKp.pubkey(), auditorPubkey, amountHi, openHi);

  const eqProof = new CiphertextCommitmentEqualityProofData(srcElGamalKp, ctRemaining, commitRemaining, openRemaining, remainingAmount);
  const valProof = new BatchedGroupedCiphertext3HandlesValidityProofData(
    srcElGamalKp.pubkey(), destElGamalKp.pubkey(), auditorPubkey,
    groupedCtLo, groupedCtHi,
    amountLo, amountHi,
    openLo, openHi
  );

  const commitments = [commitRemaining, commitLo, commitHi, commitPad];
  const amounts = new BigUint64Array([remainingAmount, amountLo, amountHi, 0n]);
  const bitLengths = new Uint8Array([64, 16, 32, 16]);
  const openings = [openRemaining, openLo, openHi, openPad];
  const rangeProof = new BatchedRangeProofU128Data(commitments, amounts, bitLengths, openings);

  console.log("Generated Proofs: Equality (320B), Batched 3-Handles Validity (544B), Batched Range U128 (1000B)");

  // -------------------------------------------------------------
  // 4. CREATE ON-CHAIN PROOF CONTEXT ACCOUNTS
  // -------------------------------------------------------------
  console.log("\n--- 4. Creating On-Chain Proof Context Accounts on Devnet ---");
  const eqContextKp = await generateKeyPairSigner();
  const valContextKp = await generateKeyPairSigner();
  const rangeContextKp = await generateKeyPairSigner();

  // Create & Verify Equality Context (Discriminator 3, 161 bytes)
  const rentEq = await rpc.getMinimumBalanceForRentExemption(BigInt(CIPHERTEXT_COMMITMENT_EQUALITY_CONTEXT_ACCOUNT_SIZE), { commitment: "confirmed" }).send();
  const ixCreateEq = getCreateAccountInstruction({
    payer, newAccount: eqContextKp, lamports: rentEq, space: CIPHERTEXT_COMMITMENT_EQUALITY_CONTEXT_ACCOUNT_SIZE, programAddress: address("ZkE1Gama1Proof11111111111111111111111111111")
  });
  const ixVerifyEq = getVerifyProofInstruction({
    discriminator: 3, proofData: eqProof.toBytes(), contextState: eqContextKp.address, contextStateAuthority: payer.address
  });
  await sendTx(rpc, payer, [payer, eqContextKp], [ixCreateEq, ixVerifyEq], "Create-Equality-Context");

  // Create & Verify Batched Validity Context (Discriminator 12, 385 bytes)
  const rentVal = await rpc.getMinimumBalanceForRentExemption(BigInt(BATCHED_GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_CONTEXT_ACCOUNT_SIZE), { commitment: "confirmed" }).send();
  const ixCreateVal = getCreateAccountInstruction({
    payer, newAccount: valContextKp, lamports: rentVal, space: BATCHED_GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_CONTEXT_ACCOUNT_SIZE, programAddress: address("ZkE1Gama1Proof11111111111111111111111111111")
  });
  const ixVerifyVal = getVerifyProofInstruction({
    discriminator: 12, proofData: valProof.toBytes(), contextState: valContextKp.address, contextStateAuthority: payer.address
  });
  await sendTx(rpc, payer, [payer, valContextKp], [ixCreateVal, ixVerifyVal], "Create-Batched-Validity-Context");

  // Create & Verify Batched Range Proof Context (Discriminator 7, 297 bytes)
  const rentRange = await rpc.getMinimumBalanceForRentExemption(BigInt(BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE), { commitment: "confirmed" }).send();
  const ixCreateRange = getCreateAccountInstruction({
    payer, newAccount: rangeContextKp, lamports: rentRange, space: BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE, programAddress: address("ZkE1Gama1Proof11111111111111111111111111111")
  });
  await sendTx(rpc, payer, [payer, rangeContextKp], [ixCreateRange], "Create-Range-Account");

  const ixVerifyRange = getVerifyProofInstruction({
    discriminator: 7, proofData: rangeProof.toBytes(), contextState: rangeContextKp.address, contextStateAuthority: payer.address
  });
  await sendTx(rpc, payer, [payer], [ixVerifyRange], "Verify-Range-Context");

  // -------------------------------------------------------------
  // 5. CONSTRUCT TRANSFER INSTRUCTION (OFFICIAL 41-BYTE ENCODED DATA)
  // -------------------------------------------------------------
  const transferData = getConfidentialTransferInstructionDataEncoder().encode({
    newSourceDecryptableAvailableBalance: srcAeKey.encrypt(remainingAmount).toBytes(),
    equalityProofInstructionOffset: 0,
    ciphertextValidityProofInstructionOffset: 0,
    rangeProofInstructionOffset: 0,
  });

  const ixTransfer = {
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    accounts: [
      { address: sourceAccountKp.address, role: 1 }, // sourceToken (Writable)
      { address: mint, role: 0 },                    // mint (Readonly)
      { address: destAccountKp.address, role: 1 },   // destinationToken (Writable)
      { address: eqContextKp.address, role: 0 },     // equalityRecord (Readonly)
      { address: valContextKp.address, role: 0 },    // ciphertextValidityRecord (Readonly)
      { address: rangeContextKp.address, role: 0 },  // rangeRecord (Readonly)
      { address: payer.address, role: 2, signer: payer }, // authority (Signer)
    ],
    data: transferData,
  };

  // -------------------------------------------------------------
  // 6. NEGATIVE TESTS VIA SIMULATION
  // -------------------------------------------------------------
  console.log("\n--- 5. Executing Negative Security Tests via Simulation ---");
  const fakeSigner = await generateKeyPairSigner();
  const fakeDest = await generateKeyPairSigner();
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();

  // Negative 1: Wrong Authority
  const ixNegAuth = {
    ...ixTransfer,
    accounts: [
      { address: sourceAccountKp.address, role: 1 },
      { address: mint, role: 0 },
      { address: destAccountKp.address, role: 1 },
      { address: eqContextKp.address, role: 0 },
      { address: valContextKp.address, role: 0 },
      { address: rangeContextKp.address, role: 0 },
      { address: fakeSigner.address, role: 2, signer: fakeSigner },
    ],
  };
  let msgNegAuth = createTransactionMessage({ version: 0 });
  msgNegAuth = setTransactionMessageFeePayerSigner(payer, msgNegAuth);
  msgNegAuth = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msgNegAuth);
  msgNegAuth = appendTransactionMessageInstructions([ixNegAuth], msgNegAuth);
  const signedNegAuth = await signTransactionMessageWithSigners(msgNegAuth);
  const simNegAuth = await rpc.simulateTransaction(getBase64EncodedWireTransaction(signedNegAuth), { commitment: "confirmed", encoding: "base64" }).send();
  console.log("[Negative Test: Wrong Authority] Err:", simNegAuth.value.err, "Logs:", simNegAuth.value.logs);

  // Negative 2: Wrong Destination Account
  const ixNegDest = {
    ...ixTransfer,
    accounts: [
      { address: sourceAccountKp.address, role: 1 },
      { address: mint, role: 0 },
      { address: fakeDest.address, role: 1 },
      { address: eqContextKp.address, role: 0 },
      { address: valContextKp.address, role: 0 },
      { address: rangeContextKp.address, role: 0 },
      { address: payer.address, role: 2, signer: payer },
    ],
  };
  let msgNegDest = createTransactionMessage({ version: 0 });
  msgNegDest = setTransactionMessageFeePayerSigner(payer, msgNegDest);
  msgNegDest = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msgNegDest);
  msgNegDest = appendTransactionMessageInstructions([ixNegDest], msgNegDest);
  const signedNegDest = await signTransactionMessageWithSigners(msgNegDest);
  const simNegDest = await rpc.simulateTransaction(getBase64EncodedWireTransaction(signedNegDest), { commitment: "confirmed", encoding: "base64" }).send();
  console.log("[Negative Test: Wrong Destination] Err:", simNegDest.value.err, "Logs:", simNegDest.value.logs);

  // -------------------------------------------------------------
  // 7. EXECUTE REAL CONFIDENTIAL TRANSFER ON DEVNET
  // -------------------------------------------------------------
  console.log("\n--- 6. Executing Real Confidential Transfer on Devnet ---");
  const transferRes = await sendTx(rpc, payer, [payer], [ixTransfer], "Real-Confidential-Transfer");

  // -------------------------------------------------------------
  // 8. POST-CONDITION VERIFICATION
  // -------------------------------------------------------------
  console.log("\n--- 7. Post-Condition Verification ---");
  const srcStateAfter = await decodeFullRawAccount(rpc, sourceAccountKp.address);
  const destStateAfter = await decodeFullRawAccount(rpc, destAccountKp.address);

  const srcDecryptedAfter = srcAeKey.decrypt(AeCiphertext.fromBytes(srcStateAfter.decryptableBytes));
  console.log("Source Account Remaining Confidential Balance Decrypted:", srcDecryptedAfter.toString());
  console.log("Destination Account Pending Credit Counter After:", destStateAfter.pendingCounter.toString());
  console.log("Destination Account Pending Ciphertext (Lo hex):", destStateAfter.pendingLoHex);

  if (destStateAfter.pendingCounter !== 1n) {
    throw new Error(`Expected destination pendingCounter === 1n, got ${destStateAfter.pendingCounter}`);
  }
  if (srcDecryptedAfter !== 40_000n) {
    throw new Error(`Expected source decrypted balance === 40,000, got ${srcDecryptedAfter}`);
  }

  console.log("\n=== STEP 6 REPORT DATA ===");
  console.log("Destination Account:", destAccountKp.address);
  console.log("Source Account:", sourceAccountKp.address);
  console.log("Transfer Signature:", transferRes.sig);
  console.log("Confirmed Slot:", transferRes.slot);
  console.log("Transfer CU:", transferRes.cu);
  console.log("Transfer Bytes:", transferRes.bytes);
  console.log("Latency:", transferRes.latency, "ms");
  console.log("\n=== STEP 6 REAL CONFIDENTIAL TRANSFER COMPLETED WITH 100% SUCCESS ===");
}
runStep6().catch(console.error);
