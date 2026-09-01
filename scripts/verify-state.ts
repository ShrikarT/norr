import { Connection, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const RPC_URL = process.env.NORR_RPC ?? "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

async function main() {
  console.log("Checking live seeded on-chain accounts on Devnet RPC...");
  const state = JSON.parse(readFileSync(resolve(repoRoot, "docs/devnet-product-state.json"), "utf8"));
  
  for (const [key, val] of Object.entries(state as Record<string, any>)) {
    const address = val.address || val.thread || val.router || val.sale;
    const info = await connection.getAccountInfo(new PublicKey(address));
    if (info) {
      console.log(`[FOUND] ${key} (${address}): owner=${info.owner.toBase58()}, lamports=${info.lamports}, dataLen=${info.data.length}`);
    } else {
      console.error(`[MISSING] ${key} (${address})`);
    }
  }
}

main().catch(console.error);
