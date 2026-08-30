import {
  getVerifyProofInstruction,
  CIPHERTEXT_COMMITMENT_EQUALITY_CONTEXT_ACCOUNT_SIZE,
  GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_CONTEXT_ACCOUNT_SIZE,
  BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE
} from "@solana-program/zk-elgamal-proof";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  createRpc, createSolanaRpcApi, createDefaultRpcTransport,
  address, createKeyPairSignerFromBytes, createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  generateKeyPairSigner, getBase64EncodedWireTransaction,
  getSignatureFromTransaction, signTransactionMessageWithSigners,
  setTransactionMessageFeePayerSigner
} from "@solana/kit";
import { readFileSync } from "fs";

const eqHex = "a05e1d004ee71d99fcba9b788466216b5503801291e8c29517c54fe990b379625a72ce9baccd03fed9d53f2bb193bde8793eafa9b42a53e34b123adb702ae70ea85b46fe4b28b555720f8c9b8df88e386b7983ce916ff57fc210cd535cf81a1e5a72ce9baccd03fed9d53f2bb193bde8793eafa9b42a53e34b123adb702ae70e5eaceaf4f55d9bce0ca7297036855ba27b4029da409389e14dadbb524f0c5f5d684d8e1f7862b38abe2edc0c63aaf78991bae5fbfc83e751588e4dce0627f912167dee7af68e82aa0f3b6f4f51953a17b1bd6ce578c4f572a9aea0f5f312f43beffc4700ca7b45f74baf62d4df7980d4688ed6299960ec5f8fff10c30b6fea07fcb70256dd3f20dae363f2decdc85915879ef278e22938d8af75e15742a0190486d19592888b60da8e1aeee6baa058450acff1c18406b18aea3773bd167d870c";
const valHex = "a05e1d004ee71d99fcba9b788466216b5503801291e8c29517c54fe990b37962baa0839e99d6ca0e834daf6c4d44cd1a0e569bdc248c8136646bd941f7a7cb6ea80d0e0ad5494b2f49f0ecaaf9a99d866d84c63c40f122e5097806f4c7a8d8185a72ce9baccd03fed9d53f2bb193bde8793eafa9b42a53e34b123adb702ae70ea85b46fe4b28b555720f8c9b8df88e386b7983ce916ff57fc210cd535cf81a1eac5a51f93a8a47fac23bbdd9f9e348355cf3ce62b39d5959af24168021be956f0295ff2f6dd41ef025337bf286a8422da5382721715044ee3c5c335b575fb32fd29b21972b78fbb203e59499a18ae5bb889b27ad582d0602eb8e71e787d15f1434c92ddbcd60c7fad79467ec0512e2fa277aa333d61d43c51acfea42865804696e0cfc11dd744c90e6f1ed84a1d29db8cf429f84a663a4f0eaa9884057e99422064b9fcac1701418d45aa6c1e09f14ee3a0dbc7eb9cf828692e3687f2bbd213674fe315b62b0b3dba9723af83377c0b4ebedc90b43dca61b1604cd9ee820ea0d6d44d4a1589f2676b35ebec19cf4c86a76747dcd6291d5fb73a2cb4daf96ff06";
const rangeHex = "5a72ce9baccd03fed9d53f2bb193bde8793eafa9b42a53e34b123adb702ae70eb20bdeb275caa6d3bbae9c5acd8dfd4d2aec1210fcf8fb9468ac54e4eee97b2a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040400000000000007ece0c61002b7488df9918b5bafe895ea8b07fc6e6f25b9f2ba3481415acc6522e2951fb8de9bc685191746ec0138e99bea980321433b0be11f37f62f879d664649ec2423fc328a5505b8dec30880c8f2ad77940521de29e85be2130c8be67768ea25a9c03f46669f229bdad6d0df002ffb950b4a8407e96a3bc290a19bac66d483b8b435f083e500ab5dcb10accea7a632b0627fe43a2e0fbf2b2b9d0f54c0a3a3d78144d669edbd07a4e9a141b1adc6c7a9e094f99d7b4268e54d05e2d8f0e01d8f0a8cf39d318b37d779a08818d71bb8e8fd6f0a55086e4e81195cd09b6073e3cee9672d6af90f528352a176487df8864ce8d9d568867dcba9fc325ed0c69186b23700ee8af02eb2ca33adcfb544514b936c234d929d1c343127a5ca9fd36cc950da25a6ec39107056606d1fe07270481c989fd0f96b27d82d51eaf25fa326ef0cb6c45aeb2bdddfe89bcddd07f752ca75033f6eade1b765c6b3ab29ec12c1007dc3951a02d8089173c40b1fadd7f8965aaef800014a592320f9d2541f54f18ce8180fa417f2dad9bf6f024eb62c2e6303b9137ad49218a30bcc0342f3e0aa88be5fac0594ba5249357fa83545060fc296acce12e518b9b22f749662e0e5cd6ad80567c0c2818974ef73dcc1f6446bb31b93bd9da4e7e848d4a885fe88a6d6ce9d789a570e0c2a04e3ad58447f368803eade54e35217b4ed2dd876338a364304a3fbd573b7a7c0dccb08a8d8c68c2ccd470e94eab1b41d4e97a4a831fd84b449d43a256442fd421f2050171246b1957c51968c64942d225ecc8419724ab326a1943a68b84e8dd4293e6f086a8acad78df43628c67a65937e386af3825d42a3c8920865a48b4a78638cbc72725cec0018ea870a2a934d37336a1f7a6ce5072cadfc4589bc0dbaddd477d1ff4646a882962fc9cebb9e148c420b693b00f32674e7150c4b257b1ab79b4c37f80ba7cf72366f6fdd2db20900597109779561f06cca384d66189c9cbacf4c977f353dda132c7a0fdeb290da2add2d144b9b40205";

async function waitConfirm(rpc, sig) {
    while (true) {
        const statuses = await rpc.getSignatureStatuses([sig]).send();
        const stat = statuses.value[0];
        if (stat && stat.confirmationStatus && (stat.confirmationStatus === 'confirmed' || stat.confirmationStatus === 'finalized')) {
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}

async function runTx(rpc, payer, ixs, name) {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    let msg = createTransactionMessage({ version: 0 });
    msg = setTransactionMessageFeePayerSigner(payer, msg);
    msg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg);
    msg = appendTransactionMessageInstructions(ixs, msg);
    
    const signedTx = await signTransactionMessageWithSigners(msg);
    const wire = getBase64EncodedWireTransaction(signedTx);
    
    // NOTE: For Range-Verify, we skip simulation here because it would fail if CreateAccount was just sent.
    // Instead we just send it directly. It will succeed on-chain if CreateAccount confirms.
    if (name !== "Range-Verify") {
        const sim = await rpc.simulateTransaction(wire, { commitment: "confirmed", encoding: "base64" }).send();
        console.log(`[${name}] Simulation CU: ${sim.value.unitsConsumed}, Err:`, sim.value.err);
        if (sim.value.err) {
            console.log(`[${name}] Simulation failed: ${JSON.stringify(sim.value.logs)}`);
            return null;
        }
    }

    try {
        const sig = await rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true }).send();
        console.log(`[${name}] Success! Sig:`, sig);
        return sig;
    } catch(e) {
        console.log(`[${name}] Send failed:`, e);
        return null;
    }
}

async function run() {
  const rpc = createRpc({ api: createSolanaRpcApi(), transport: createDefaultRpcTransport({ url: "https://api.devnet.solana.com" }) });
  
  const keypairRaw = JSON.parse(readFileSync("wsl-payer.json", "utf-8"));
  const payer = await createKeyPairSignerFromBytes(new Uint8Array(keypairRaw));
  const zkProgram = address("ZkE1Gama1Proof11111111111111111111111111111");
  
  // 1. Equality
  const eqCtx = await generateKeyPairSigner();
  const eqRent = await rpc.getMinimumBalanceForRentExemption(BigInt(CIPHERTEXT_COMMITMENT_EQUALITY_CONTEXT_ACCOUNT_SIZE), {commitment: "confirmed"}).send();
  const ixEqCreate = getCreateAccountInstruction({
    payer, newAccount: eqCtx,
    lamports: eqRent, space: CIPHERTEXT_COMMITMENT_EQUALITY_CONTEXT_ACCOUNT_SIZE,
    programAddress: zkProgram
  });
  const ixEqVerify = getVerifyProofInstruction({
    contextState: eqCtx.address,
    discriminator: 3, 
    proofData: new Uint8Array(Buffer.from(eqHex, "hex"))
  });
  await runTx(rpc, payer, [ixEqCreate, ixEqVerify], "Equality");

  // 2. Validity
  const valCtx = await generateKeyPairSigner();
  const valRent = await rpc.getMinimumBalanceForRentExemption(BigInt(GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_CONTEXT_ACCOUNT_SIZE), {commitment: "confirmed"}).send();
  const ixValCreate = getCreateAccountInstruction({
    payer, newAccount: valCtx,
    lamports: valRent, space: GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_CONTEXT_ACCOUNT_SIZE,
    programAddress: zkProgram
  });
  const ixValVerify = getVerifyProofInstruction({
    contextState: valCtx.address,
    discriminator: 11, 
    proofData: new Uint8Array(Buffer.from(valHex, "hex"))
  });
  await runTx(rpc, payer, [ixValCreate, ixValVerify], "Validity");

  // 3. Range
  const rangeCtx = await generateKeyPairSigner();
  const rangeRent = await rpc.getMinimumBalanceForRentExemption(BigInt(BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE), {commitment: "confirmed"}).send();
  const ixRangeCreate = getCreateAccountInstruction({
    payer, newAccount: rangeCtx,
    lamports: rangeRent, space: BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE,
    programAddress: zkProgram
  });
  const sigCreate = await runTx(rpc, payer, [ixRangeCreate], "Range-Create");
  
  if (sigCreate) {
      console.log("Waiting for Range-Create to confirm before verifying...");
      await waitConfirm(rpc, sigCreate);
      
      const ixRangeVerify = getVerifyProofInstruction({
        contextState: rangeCtx.address,
        discriminator: 7, 
        proofData: new Uint8Array(Buffer.from(rangeHex, "hex"))
      });
      await runTx(rpc, payer, [ixRangeVerify], "Range-Verify");
  }
  
  console.log("All step 3 tests executed successfully!");
  process.exit(0);
}
run();

