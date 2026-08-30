import { parseArgs } from 'util';
import { readFileSync, writeFileSync } from 'fs';
import { 
  createRpc, 
  createSolanaRpcApi, 
  createDefaultRpcTransport,
  address,
  createKeyPairSignerFromBytes,
  pipe,
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
  getInitializeMintInstruction, 
  getInitializeConfidentialTransferMintInstruction, 
  TOKEN_2022_PROGRAM_ADDRESS,
  decodeMint,
} from "@solana-program/token-2022";

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean' },
    'rpc': { type: 'string' },
    'keypair': { type: 'string' },
    'auditor-pubkey': { type: 'string' },
  },
  strict: false,
});

async function main() {
  const isSimulated = !!values['dry-run'];
  console.log(`Starting P0 Runner in ${isSimulated ? 'SIMULATED' : 'TARGET-CLUSTER'} mode.`);

  if (isSimulated) {
    await runSimulated();
  } else {
    await runTargetCluster();
  }
}

async function runSimulated() {
  console.log("SIMULATED MODE: Generating mock evidence.");
  const report = {
    schema: "norr-p0-v1",
    isSimulated: true,
    genesisHash: "mock-genesis",
    status: "blocked",
    message: "Dry-run mode activated. No target-cluster signatures were captured.",
    transactions: {},
  };
  writeFileSync('p0-report.SIMULATED.json', JSON.stringify(report, null, 2));
  console.log("Simulated report written to p0-report.SIMULATED.json");
}

async function runTargetCluster() {
  if (!values.rpc) throw new Error("Missing --rpc URL");
  if (!values.keypair) throw new Error("Missing --keypair path");
  if (!values['auditor-pubkey']) throw new Error("Missing --auditor-pubkey. A test auditor ElGamal public key MUST be supplied via command line.");
  
  console.log(`Connecting to ${values.rpc}...`);
  const rpc = createRpc<any, any>({
    api: createSolanaRpcApi(),
    transport: createDefaultRpcTransport({ url: values.rpc }),
  });

  // Enforce explicit commitment on RPC calls to prevent Devnet 'missing field commitment' errors
  type StrictConfig = { commitment: 'confirmed' | 'finalized' | 'processed' };
  
  const strictGetMinimumBalance = async (space: bigint, config: StrictConfig) => rpc.getMinimumBalanceForRentExemption(space, config).send();
  const strictGetGenesisHash = async () => rpc.getGenesisHash().send();
  const strictGetBalance = async (address: any, config: StrictConfig) => rpc.getBalance(address, config).send();
  const strictGetAccountInfo = async (address: any, config: StrictConfig) => rpc.getAccountInfo(address, config).send();
  const strictGetLatestBlockhash = async (config: StrictConfig) => rpc.getLatestBlockhash(config).send();
  
  const genesisHash = await strictGetGenesisHash();
  console.log("Actual Genesis Hash:", genesisHash);

  const keypairRaw = JSON.parse(readFileSync(values.keypair as string, 'utf-8'));
  const payer = await createKeyPairSignerFromBytes(new Uint8Array(keypairRaw));
  console.log("Payer address:", payer.address);

  const balance = await strictGetBalance(payer.address, { commitment: 'confirmed' });
  if (balance.value === 0n) throw new Error("Payer is unfunded! A funded wallet is required to pay rent/fees.");

  const t22Info = await strictGetAccountInfo(TOKEN_2022_PROGRAM_ADDRESS, { commitment: 'confirmed' });
  if (!t22Info.value?.executable) throw new Error("Token-2022 program not executable on target cluster.");

  console.log("\n--- STEP 1: AUDITOR-ENABLED CONFIDENTIAL MINT CREATION ---");
  
  const auditorPubkeyStr = values['auditor-pubkey'] as string;
  console.log("Using provided Auditor ElGamal Pubkey:", auditorPubkeyStr);

  const mintSigner = await generateKeyPairSigner();
  console.log("Generated New Mint:", mintSigner.address);

  // Exact space required for Mint + ConfidentialTransferMint
  const space = 235n;
  const rent = await strictGetMinimumBalance(space, { commitment: 'confirmed' });

  console.log("Constructing instructions...");
  
  const createAccIx = getCreateAccountInstruction({
    payer,
    newAccount: mintSigner,
    lamports: rent,
    space,
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const initCTMintIx = getInitializeConfidentialTransferMintInstruction({
    mint: mintSigner.address,
    authority: payer.address,
    autoApproveNewAccounts: true,
    auditorElgamalPubkey: address(auditorPubkeyStr),
  });

  const initMintIx = getInitializeMintInstruction({
    mint: mintSigner.address,
    decimals: 6,
    mintAuthority: payer.address,
    freezeAuthority: payer.address,
  });

  const latestBlockhash = await strictGetLatestBlockhash({ commitment: 'confirmed' });

  let txMsg = createTransactionMessage({ version: 0 });
  txMsg = appendTransactionMessageInstructions([createAccIx, initCTMintIx, initMintIx], txMsg);
  txMsg = setTransactionMessageFeePayer(payer.address, txMsg);
  txMsg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash.value, txMsg);

  console.log("Simulating transaction...");
  const compiled = compileTransaction(txMsg);
  const wireBytesPre = getBase64EncodedWireTransaction(compiled);
  const simulation = await rpc.simulateTransaction(wireBytesPre, { commitment: 'confirmed', encoding: 'base64' }).send();
  
  if (simulation.value.err) {
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }
  console.log(`Simulation successful. CU Consumed: ${simulation.value.unitsConsumed}`);

  console.log("Signing in memory...");
  const signedTx = await signTransactionMessageWithSigners(txMsg);
  
  const wireBytesSigned = getBase64EncodedWireTransaction(signedTx);
  const byteSize = Buffer.from(wireBytesSigned, 'base64').length;
  console.log(`Serialized transaction size: ${byteSize} bytes`);
  
  if (byteSize > 1232) {
    throw new Error(`Transaction size ${byteSize} exceeds the 1232-byte limit!`);
  }

  console.log("Submitting transaction to Devnet...");
  const signature = await rpc.sendTransaction(wireBytesSigned, { skipPreflight: true, encoding: 'base64' }).send();
  console.log(`Transaction submitted! Signature: ${signature}`);

  console.log("Waiting for confirmation...");
  let confirmed = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const status = await rpc.getSignatureStatuses([signature]).send();
    const result = status.value[0];
    if (result) {
      if (result.err) throw new Error(`Transaction failed on chain: ${JSON.stringify(result.err)}`);
      if (result.confirmationStatus === 'confirmed' || result.confirmationStatus === 'finalized') {
        console.log(`Confirmed in slot ${result.slot}!`);
        confirmed = true;
        break;
      }
    }
  }
  if (!confirmed) throw new Error("Transaction confirmation timed out.");

  console.log("Verifying postconditions on-chain...");
  const encodedAccount = await fetchEncodedAccount(rpc, mintSigner.address, { commitment: 'confirmed' });
  if (!encodedAccount.exists) throw new Error("Mint account not found on-chain");
  
  if (encodedAccount.programAddress !== TOKEN_2022_PROGRAM_ADDRESS) {
    throw new Error(`Mint owner mismatch! Expected ${TOKEN_2022_PROGRAM_ADDRESS}, got ${encodedAccount.programAddress}`);
  }

  const mintData = decodeMint(encodedAccount);
  
  const extensions = mintData.data.extensions?.value;
  if (!extensions) {
    throw new Error("Mint has no extensions configured");
  }

  const ctExt = extensions?.find((e: any) => e.__kind === 'ConfidentialTransferMint');
  if (!ctExt) throw new Error("ConfidentialTransferMint extension is missing");

  // Type cast for access
  const extData = ctExt as any;

  if (extData.authority?.value !== payer.address) {
    throw new Error("ConfidentialTransfer authority does not match payer");
  }
  if (extData.autoApproveNewAccounts !== true) {
    throw new Error("autoApproveNewAccounts is false");
  }
  if (extData.auditorElgamalPubkey?.value !== auditorPubkeyStr) {
    throw new Error("auditorElgamalPubkey does not match supplied test key");
  }

  console.log("SUCCESS: Auditor-enabled Confidential Mint created and verified on-chain via official Token-2022 decoder.");
  console.log("---------------------------------------------------------");
  
  throw new Error("Target cluster execution BLOCKED for steps 2-9.");
}

main().catch(err => {
  console.error("FATAL ERROR:", err.message);
  process.exit(1);
});
