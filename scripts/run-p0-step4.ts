import { getConfidentialDepositInstruction } from "@solana-program/token-2022";
import { createRpc, createSolanaRpcApi, createDefaultRpcTransport, address, createKeyPairSignerFromBytes, createTransactionMessage, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions, signTransactionMessageWithSigners, getBase64EncodedWireTransaction, setTransactionMessageFeePayerSigner } from "@solana/kit";
import { readFileSync } from "fs";

async function run() {
  const rpc = createRpc({ api: createSolanaRpcApi(), transport: createDefaultRpcTransport({ url: "https://api.devnet.solana.com" }) });
  const keypairRaw = JSON.parse(readFileSync("wsl-payer.json", "utf-8"));
  const payer = await createKeyPairSignerFromBytes(new Uint8Array(keypairRaw));

  const mint = address("6RBs6aoEpQZ59aKfpqWE2SnAX3cysBo3whFuhBoe9suT");
  const token = address("HKrZcotGz9MCJz1yLzBq4Cd6mYFViNb8iCgtY3gTRSMm");

  const ixDeposit = getConfidentialDepositInstruction({
    mint,
    token,
    authority: payer,
    amount: 500_000n,
    decimals: 6,
  });

  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  let msg = createTransactionMessage({ version: 0 });
  msg = setTransactionMessageFeePayerSigner(payer, msg);
  msg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg);
  msg = appendTransactionMessageInstructions([ixDeposit], msg);
  
  const signedTx = await signTransactionMessageWithSigners(msg);
  const wire = getBase64EncodedWireTransaction(signedTx);
  const size = Buffer.from(wire, 'base64').length;
  console.log("Tx size:", size, "bytes");

  const sim = await rpc.simulateTransaction(wire, { commitment: "confirmed", encoding: "base64" }).send();
  console.log("Deposit Sim CU:", sim.value.unitsConsumed, "Err:", sim.value.err);
  if (sim.value.err) {
      console.log("Simulation logs:", sim.value.logs);
      return;
  }
  
  const sig = await rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true }).send();
  console.log("Deposit Sig:", sig);
  
  while (true) {
    const statuses = await rpc.getSignatureStatuses([sig]).send();
    const stat = statuses.value[0];
    if (stat && stat.confirmationStatus && (stat.confirmationStatus === 'confirmed' || stat.confirmationStatus === 'finalized')) {
        console.log("Confirmed Slot:", stat.slot);
        break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}
run();

