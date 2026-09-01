import { createRpc, createSolanaRpcApi, createDefaultRpcTransport, address } from "@solana/kit";

const RPC_URL = process.env.NORR_RPC ?? "https://api.devnet.solana.com";
const rpc = createRpc({
  api: createSolanaRpcApi(),
  transport: createDefaultRpcTransport({ url: RPC_URL }),
});

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const programs: Record<string, string> = JSON.parse(
  readFileSync(resolve(repoRoot, "program-ids.json"), "utf8")
);

async function main() {
  console.log("Checking 7 Norr programs on Devnet (" + RPC_URL + ")...");
  for (const [name, id] of Object.entries(programs)) {
    const acc = await rpc.getAccountInfo(address(id), { encoding: "jsonParsed" }).send();
    if (acc.value) {
      console.log(`[FOUND] ${name} (${id}): executable=${acc.value.executable}, owner=${acc.value.owner}, lamports=${acc.value.lamports}`);
    } else {
      console.log(`[NOT FOUND] ${name} (${id}): Undeployed / No account`);
    }
  }
}

main().catch(console.error);
