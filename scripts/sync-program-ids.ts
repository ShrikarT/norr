import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const newIds: Record<string, string> = JSON.parse(
  readFileSync(resolve(repoRoot, "program-ids.json"), "utf8")
);

console.log("Syncing program IDs across entire repository:", newIds);

// 1. Anchor.toml
let anchorToml = readFileSync(resolve(repoRoot, "Anchor.toml"), "utf8");
for (const [k, v] of Object.entries(newIds)) {
  anchorToml = anchorToml.replace(new RegExp(`${k}\\s*=\\s*"[^"]+"`), `${k} = "${v}"`);
}
writeFileSync(resolve(repoRoot, "Anchor.toml"), anchorToml);

// 2. programs/norr-*/src/lib.rs
const programDirMap: Record<string, string> = {
  norr_launch: "norr-launch",
  norr_claim: "norr-claim",
  norr_fees: "norr-fees",
  norr_market: "norr-market",
  norr_boards: "norr-boards",
  norr_social: "norr-social",
  norr_wrap: "norr-wrap",
};

for (const [name, dir] of Object.entries(programDirMap)) {
  const libPath = resolve(repoRoot, `programs/${dir}/src/lib.rs`);
  let src = readFileSync(libPath, "utf8");
  src = src.replace(/declare_id!\("[^"]+"\);/, `declare_id!("${newIds[name]}");`);
  if (dir === "norr-boards") {
    src = src.replace(
      /pub const NORR_LAUNCH_ID: Pubkey =\s*anchor_lang::solana_program::pubkey!\("[^"]+"\);/,
      `pub const NORR_LAUNCH_ID: Pubkey =\n    anchor_lang::solana_program::pubkey!("${newIds.norr_launch}");`
    );
  }
  writeFileSync(libPath, src);
}

// 3. packages/sdk/src/idl/norr_*.ts
for (const [name, id] of Object.entries(newIds)) {
  const idlPath = resolve(repoRoot, `packages/sdk/src/idl/${name}.ts`);
  if (existsSync(idlPath)) {
    let src = readFileSync(idlPath, "utf8");
    src = src.replace(/"address":\s*"[^"]+"/, `"address": "${id}"`);
    writeFileSync(idlPath, src);
  }
}

// 4. apps/web/src/lib/config.ts
const configPath = resolve(repoRoot, "apps/web/src/lib/config.ts");
let configSrc = readFileSync(configPath, "utf8");
for (const [k, v] of Object.entries(newIds)) {
  const shortKey = k.replace("norr_", "");
  configSrc = configSrc.replace(new RegExp(`${shortKey}:\\s*"[^"]+"`), `${shortKey}: "${v}"`);
}
writeFileSync(configPath, configSrc);

// 5. deployments/*.json
for (const dep of ["devnet.json", "localnet.json", "mainnet.json"]) {
  const depPath = resolve(repoRoot, `deployments/${dep}`);
  if (existsSync(depPath)) {
    const json = JSON.parse(readFileSync(depPath, "utf8"));
    for (const [k, v] of Object.entries(newIds)) {
      if (json.programs[k]) json.programs[k].address = v;
    }
    writeFileSync(depPath, JSON.stringify(json, null, 2));
  }
}

console.log("✓ All program IDs synchronized successfully.");
