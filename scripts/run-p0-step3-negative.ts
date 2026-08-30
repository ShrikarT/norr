import { getVerifyProofInstruction, BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE } from "@solana-program/zk-elgamal-proof";
import { getCreateAccountInstruction } from "@solana-program/system";
import { createRpc, createSolanaRpcApi, createDefaultRpcTransport, address, createKeyPairSignerFromBytes, createTransactionMessage, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions, generateKeyPairSigner, getBase64EncodedWireTransaction, signTransactionMessageWithSigners, setTransactionMessageFeePayerSigner } from "@solana/kit";
import { readFileSync } from "fs";

const rangeHex = "5a72ce9baccd03fed9d53f2bb193bde8793eafa9b42a53e34b123adb702ae70eb20bdeb275caa6d3bbae9c5acd8dfd4d2aec1210fcf8fb9468ac54e4eee97b2a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040400000000000007ece0c61002b7488df9918b5bafe895ea8b07fc6e6f25b9f2ba3481415acc6522e2951fb8de9bc685191746ec0138e99bea980321433b0be11f37f62f879d664649ec2423fc328a5505b8dec30880c8f2ad77940521de29e85be2130c8be67768ea25a9c03f46669f229bdad6d0df002ffb950b4a8407e96a3bc290a19bac66d483b8b435f083e500ab5dcb10accea7a632b0627fe43a2e0fbf2b2b9d0f54c0a3a3d78144d669edbd07a4e9a141b1adc6c7a9e094f99d7b4268e54d05e2d8f0e01d8f0a8cf39d318b37d779a08818d71bb8e8fd6f0a55086e4e81195cd09b6073e3cee9672d6af90f528352a176487df8864ce8d9d568867dcba9fc325ed0c69186b23700ee8af02eb2ca33adcfb544514b936c234d929d1c343127a5ca9fd36cc950da25a6ec39107056606d1fe07270481c989fd0f96b27d82d51eaf25fa326ef0cb6c45aeb2bdddfe89bcddd07f752ca75033f6eade1b765c6b3ab29ec12c1007dc3951a02d8089173c40b1fadd7f8965aaef800014a592320f9d2541f54f18ce8180fa417f2dad9bf6f024eb62c2e6303b9137ad49218a30bcc0342f3e0aa88be5fac0594ba5249357fa83545060fc296acce12e518b9b22f749662e0e5cd6ad80567c0c2818974ef73dcc1f6446bb31b93bd9da4e7e848d4a885fe88a6d6ce9d789a570e0c2a04e3ad58447f368803eade54e35217b4ed2dd876338a364304a3fbd573b7a7c0dccb08a8d8c68c2ccd470e94eab1b41d4e97a4a831fd84b449d43a256442fd421f2050171246b1957c51968c64942d225ecc8419724ab326a1943a68b84e8dd4293e6f086a8acad78df43628c67a65937e386af3825d42a3c8920865a48b4a78638cbc72725cec0018ea870a2a934d37336a1f7a6ce5072cadfc4589bc0dbaddd477d1ff4646a882962fc9cebb9e148c420b693b00f32674e7150c4b257b1ab79b4c37f80ba7cf72366f6fdd2db20900597109779561f06cca384d66189c9cbacf4c977f353dda132c7a0fdeb290da2add2d144b9b40205";

async function simulate(rpc, payer, ixs, name) {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    let msg = createTransactionMessage({ version: 0 });
    msg = setTransactionMessageFeePayerSigner(payer, msg);
    msg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg);
    msg = appendTransactionMessageInstructions(ixs, msg);
    const signedTx = await signTransactionMessageWithSigners(msg);
    const wire = getBase64EncodedWireTransaction(signedTx);
    const sim = await rpc.simulateTransaction(wire, { commitment: "confirmed", encoding: "base64" }).send();
    console.log(`[${name}] Err:`, sim.value.err, `Logs:`, sim.value.logs);
}

async function run() {
  const rpc = createRpc({ api: createSolanaRpcApi(), transport: createDefaultRpcTransport({ url: "https://api.devnet.solana.com" }) });
  const keypairRaw = JSON.parse(readFileSync("wsl-payer.json", "utf-8"));
  const payer = await createKeyPairSignerFromBytes(new Uint8Array(keypairRaw));
  const zkProgram = address("ZkE1Gama1Proof11111111111111111111111111111");

  // Mutate proof byte
  let badHex = rangeHex.slice(0, 1000) + "ff" + rangeHex.slice(1002);
  
  
  // Actually let's simulate a brand new CreateAccount + VerifyProof in same TX
  const rangeCtx = await generateKeyPairSigner();
  const rangeRent = await rpc.getMinimumBalanceForRentExemption(BigInt(BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE), {commitment: "confirmed"}).send();
  const ixRangeCreate = getCreateAccountInstruction({
    payer, newAccount: rangeCtx,
    lamports: rangeRent, space: BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE,
    programAddress: zkProgram
  });
  const ixBadVerify = getVerifyProofInstruction({
    contextState: rangeCtx.address,
    discriminator: 7, 
    proofData: new Uint8Array(Buffer.from(badHex, "hex"))
  });

  await simulate(rpc, payer, [ixRangeCreate, ixBadVerify], "Negative-AlteredProof");
  
  // Alter context binding (change a byte in the commitment)
  let badContextHex = "ff" + rangeHex.slice(2);
  const ixBadCtx = getVerifyProofInstruction({
    contextState: rangeCtx.address,
    discriminator: 7, 
    proofData: new Uint8Array(Buffer.from(badContextHex, "hex"))
  });
  await simulate(rpc, payer, [ixRangeCreate, ixBadCtx], "Negative-AlteredContext");
}
run();


