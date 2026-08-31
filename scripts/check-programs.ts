import { createRpc, createSolanaRpcApi, createDefaultRpcTransport, address } from "@solana/kit";

const RPC_URL = process.env.NORR_RPC ?? "https://api.devnet.solana.com";
const rpc = createRpc({
  api: createSolanaRpcApi(),
  transport: createDefaultRpcTransport({ url: RPC_URL }),
});

const programs: Record<string, string> = {
  norr_launch: "Hh8FAARfcY4e9MJSMVpfv4eae8aeA94a4gyHRJhrtkcr",
  norr_claim: "GL8hxTuRfXZQMZfvS4RNoT8D1EVKSUpQTLZKsQq9oJaE",
  norr_fees: "4aou9742wef3vMVnZdSUs66G9GvDDJUrmvTHTKLBx2jk",
  norr_market: "D8PSneY6UbBgj5tv5FNxa7FoEzHPwobvdcoAXBphPqTY",
  norr_boards: "48Fz4Shqtu9MZBXuAKc1rwm4wQsxcRdkzMtQiW7vdcm2",
  norr_social: "E2yvUMyHW1WvqLGA9DNNeEk44b1toJDwk1RoseEYham8",
  norr_wrap: "BjF6Y5RUpD3KufxV4VPeS6thYnQNt6Cas6hfQXdqf6Rn",
};

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
