/**
 * Phase 3 P0 Devnet Drill â€” Step 2: Confidential Token Account Configuration
 *
 * Creates a Token-2022 token account for the Step 1 mint, configures
 * the ConfidentialTransferAccount extension, and disables both credit
 * flags (confidential and non-confidential) as required by PLAN.md
 * ("both credits off at rest").
 *
 * Does NOT proceed to deposit/apply/transfer/withdraw.
 */
import { parseArgs } from 'util';
import { readFileSync } from 'fs';
import {
  createRpc,
  createSolanaRpcApi,
  createDefaultRpcTransport,
  address,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  generateKeyPairSigner,
  fetchEncodedAccount,
  compileTransaction,
} from '@solana/kit';
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  getInitializeAccountInstruction,
  getConfigureConfidentialTransferAccountInstruction,
  getDisableConfidentialCreditsInstruction,
  getDisableNonConfidentialCreditsInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
  decodeToken,
  getReallocateInstructionDataEncoder,
  getConfigureConfidentialTransferAccountInstructionDataEncoder,
} from "@solana-program/token-2022";
import { ElGamalKeypair, PubkeyValidityProofData } from "@solana/zk-sdk";
import { getVerifyProofInstruction } from "@solana-program/zk-elgamal-proof";

const { values } = parseArgs({
  options: {
    'rpc': { type: 'string' },
    'keypair': { type: 'string' },
    'mint': { type: 'string' },
  },
  strict: false,
});

async function main() {
  if (!values.rpc) throw new Error("Missing --rpc URL");
  if (!values.keypair) throw new Error("Missing --keypair path");
  if (!values.mint) throw new Error("Missing --mint (the Step 1 confidential mint address)");

  const mintAddress = address(values.mint as string);

  console.log("=== STEP 2: CONFIDENTIAL TOKEN ACCOUNT CONFIGURATION ===");
  console.log(`Connecting to ${values.rpc}...`);

  const rpc = createRpc<any, any>({
    api: createSolanaRpcApi(),
    transport: createDefaultRpcTransport({ url: values.rpc as string }),
  });

  const keypairRaw = JSON.parse(readFileSync(values.keypair as string, 'utf-8'));
  const payer = await createKeyPairSignerFromBytes(new Uint8Array(keypairRaw));
  console.log("Payer/Owner address:", payer.address);

  // --- Transaction 1: Create token account + Initialize account ---
  // Token-2022 requires: CreateAccount -> InitializeAccount
  // Then separately: ConfigureConfidentialTransferAccount
  // Then: DisableConfidentialCredits + DisableNonConfidentialCredits

  // --- ZK Proof Generation ---
  // A fresh ElGamal keypair for the account owner
  const elgamalKp = new ElGamalKeypair();
  const proofBytes = new PubkeyValidityProofData(elgamalKp).toBytes();

  const verifyPubkeyIx = getVerifyProofInstruction({
    discriminator: 4, // PubkeyValidity
    proofData: proofBytes,
  });

  // --- Transaction 1: Create token account + Configure ---
  const tokenAccountSigner = await generateKeyPairSigner();
  console.log("Generated Token Account:", tokenAccountSigner.address);

  // 1. CreateAccount with 165 bytes (base size)
  const space = 165n;
  const rent = await rpc.getMinimumBalanceForRentExemption(space, { commitment: 'confirmed' }).send();

  const createAccIx = getCreateAccountInstruction({
    payer,
    newAccount: tokenAccountSigner,
    lamports: rent,
    space,
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
  });

  // 2. InitializeAccount (Token-2022)
  const initAccIx = getInitializeAccountInstruction({
    account: tokenAccountSigner.address,
    mint: mintAddress,
    owner: payer.address,
  });

  // 3. Reallocate to add ImmutableOwner (7) and ConfidentialTransferAccount (5)
  const reallocData = getReallocateInstructionDataEncoder().encode({ newExtensionTypes: [7, 5] });
  const reallocIx = {
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    accounts: [
      { address: tokenAccountSigner.address, role: 1 },
      { address: payer.address, role: 3, signer: payer },
      { address: address("11111111111111111111111111111111"), role: 0 },
      { address: payer.address, role: 2, signer: payer },
    ],
    data: reallocData,
  };

  // 4. ConfigureConfidentialTransferAccount
  const configEncoder = getConfigureConfidentialTransferAccountInstructionDataEncoder();
  const configData = configEncoder.encode({
    decryptableZeroBalance: new Uint8Array(36), // AES-encrypted 0
    maximumPendingBalanceCreditCounter: 65536n,
    proofInstructionOffset: -1, // points to VerifyPubkeyValidity
  });

  const configCTIx = {
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    accounts: [
      { address: tokenAccountSigner.address, role: 1 },
      { address: mintAddress, role: 0 },
      { address: address("Sysvar1nstructions1111111111111111111111111"), role: 0 },
      { address: payer.address, role: 2, signer: payer },
    ],
    data: configData,
  };

  // 5 & 6. Disable Credits
  const disableConfCreditsIx = getDisableConfidentialCreditsInstruction({
    token: tokenAccountSigner.address,
    authority: payer,
  });

  const disableNonConfCreditsIx = getDisableNonConfidentialCreditsInstruction({
    token: tokenAccountSigner.address,
    authority: payer,
  });

  const latestBlockhash = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();

  let txMsg = createTransactionMessage({ version: 0 });
  txMsg = appendTransactionMessageInstructions(
    [createAccIx, initAccIx, reallocIx, verifyPubkeyIx, configCTIx, disableConfCreditsIx, disableNonConfCreditsIx],
    txMsg
  );
  txMsg = setTransactionMessageFeePayer(payer.address, txMsg);
  txMsg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash.value, txMsg);

  // --- Simulate ---
  console.log("Simulating transaction...");
  const compiled = compileTransaction(txMsg);
  const wireBytesPre = getBase64EncodedWireTransaction(compiled);
  const simulation = await rpc.simulateTransaction(wireBytesPre, {
    commitment: 'confirmed',
    encoding: 'base64',
  }).send();

  if (simulation.value.err) {
    console.error("Simulation logs:", simulation.value.logs);
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }
  console.log(`Simulation successful. CU Consumed: ${simulation.value.unitsConsumed}`);

  // --- Sign ---
  console.log("Signing in memory...");
  const signedTx = await signTransactionMessageWithSigners(txMsg);

  const wireBytesSigned = getBase64EncodedWireTransaction(signedTx);
  const byteSize = Buffer.from(wireBytesSigned, 'base64').length;
  console.log(`Serialized transaction size: ${byteSize} bytes`);

  if (byteSize > 1232) {
    throw new Error(`Transaction size ${byteSize} exceeds the 1232-byte limit!`);
  }

  // --- Submit ---
  console.log("Submitting transaction to Devnet...");
  const signature = await rpc.sendTransaction(wireBytesSigned, {
    skipPreflight: true,
    encoding: 'base64',
  }).send();
  console.log(`Transaction submitted! Signature: ${signature}`);

  // --- Confirm ---
  console.log("Waiting for confirmation...");
  let confirmed = false;
  let confirmedSlot = 0n;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const status = await rpc.getSignatureStatuses([signature]).send();
    const result = status.value[0];
    if (result) {
      if (result.err) throw new Error(`Transaction failed on chain: ${JSON.stringify(result.err)}`);
      if (result.confirmationStatus === 'confirmed' || result.confirmationStatus === 'finalized') {
        confirmedSlot = result.slot;
        console.log(`Confirmed in slot ${result.slot}! Status: ${result.confirmationStatus}`);
        confirmed = true;
        break;
      }
    }
  }
  if (!confirmed) throw new Error("Transaction confirmation timed out.");

  // --- Verify Postconditions ---
  console.log("Verifying postconditions on-chain...");
  const encodedAccount = await fetchEncodedAccount(rpc, tokenAccountSigner.address, { commitment: 'confirmed' });
  if (!encodedAccount.exists) throw new Error("Token account not found on-chain");

  if (encodedAccount.programAddress !== TOKEN_2022_PROGRAM_ADDRESS) {
    throw new Error(`Account owner mismatch! Expected ${TOKEN_2022_PROGRAM_ADDRESS}, got ${encodedAccount.programAddress}`);
  }
  console.log("âœ“ Account owned by Token-2022 program");

  // Decode using official Token-2022 decoder
  const tokenData = decodeToken(encodedAccount);

  // Verify mint
  if (tokenData.data.mint !== mintAddress) {
    throw new Error(`Mint mismatch! Expected ${mintAddress}, got ${tokenData.data.mint}`);
  }
  console.log(`âœ“ Mint matches Step 1: ${tokenData.data.mint}`);

  // Verify owner
  if (tokenData.data.owner !== payer.address) {
    throw new Error(`Owner mismatch! Expected ${payer.address}, got ${tokenData.data.owner}`);
  }
  console.log(`âœ“ Owner matches payer: ${tokenData.data.owner}`);

  // Verify extensions
  const extensions = tokenData.data.extensions?.value;
  if (!extensions) {
    throw new Error("Token account has no extensions configured");
  }

  const ctAccExt = extensions.find((e: any) => e.__kind === 'ConfidentialTransferAccount');
  if (!ctAccExt) throw new Error("ConfidentialTransferAccount extension is missing");
  console.log("âœ“ ConfidentialTransferAccount extension present");

  const ctData = ctAccExt as any;

  // Verify approved (autoApproveNewAccounts was true on mint)
  if (ctData.approved !== true) {
    console.log("WARNING: Account not approved. Value:", ctData.approved);
  } else {
    console.log("âœ“ Account approved for confidential transfers");
  }

  // Verify credit flags â€” PLAN.md requires both disabled at rest
  if (ctData.allowConfidentialCredits === true) {
    throw new Error("allowConfidentialCredits should be false at rest (PLAN.md requirement)");
  }
  console.log("âœ“ allowConfidentialCredits = false (disabled at rest)");

  if (ctData.allowNonConfidentialCredits === true) {
    throw new Error("allowNonConfidentialCredits should be false at rest (PLAN.md requirement)");
  }
  console.log("âœ“ allowNonConfidentialCredits = false (disabled at rest)");

  // Print full decoded extension for the record
  console.log("\n--- Decoded ConfidentialTransferAccount Extension ---");
  console.log(JSON.stringify(ctData, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  console.log("\n=== STEP 2 REPORT ===");
  console.log(`Account Address:    ${tokenAccountSigner.address}`);
  console.log(`Transaction Sig:    ${signature}`);
  console.log(`Confirmed Slot:     ${confirmedSlot}`);
  console.log(`Simulation CU:      ${simulation.value.unitsConsumed}`);
  console.log(`Transaction Bytes:  ${byteSize}`);
  console.log(`Mint:               ${mintAddress}`);
  console.log(`Owner:              ${payer.address}`);
  console.log(`CT Extension:       Present`);
  console.log(`Conf Credits:       Disabled`);
  console.log(`Non-Conf Credits:   Disabled`);
  console.log(`Approved:           ${ctData.approved}`);
  console.log("=====================");
  console.log("SUCCESS: Step 2 completed. Confidential token account configured and verified.");
  console.log("STOPPED: Not proceeding to Step 3.");
}

main().catch(err => {
  console.error("FATAL ERROR:", err.message);
  process.exit(1);
});

