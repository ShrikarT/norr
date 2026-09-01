import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

test("all 7 program IDs are 100% consistent across entire codebase", () => {
  const canonicalIds: Record<string, string> = JSON.parse(
    readFileSync(resolve(repoRoot, "program-ids.json"), "utf8")
  );

  // 1. Check Anchor.toml
  const anchorToml = readFileSync(resolve(repoRoot, "Anchor.toml"), "utf8");
  for (const [name, id] of Object.entries(canonicalIds)) {
    assert.ok(
      anchorToml.includes(`${name} = "${id}"`),
      `Anchor.toml missing ${name} = "${id}"`
    );
  }

  // 2. Check programs/norr-*/src/lib.rs
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
    const libRs = readFileSync(resolve(repoRoot, `programs/${dir}/src/lib.rs`), "utf8");
    assert.ok(
      libRs.includes(`declare_id!("${canonicalIds[name]}");`),
      `programs/${dir}/src/lib.rs declare_id! mismatch`
    );
  }

  // Check NORR_LAUNCH_ID in norr-boards
  const boardsLib = readFileSync(resolve(repoRoot, "programs/norr-boards/src/lib.rs"), "utf8");
  assert.ok(
    boardsLib.includes(`pubkey!("${canonicalIds.norr_launch}")`),
    "NORR_LAUNCH_ID mismatch in norr-boards"
  );

  // 3. Check deployments/devnet.json
  const devnetJson = JSON.parse(
    readFileSync(resolve(repoRoot, "deployments/devnet.json"), "utf8")
  );
  for (const [name, id] of Object.entries(canonicalIds)) {
    assert.equal(
      devnetJson.programs[name].address,
      id,
      `deployments/devnet.json ${name} mismatch`
    );
  }

  // 4. Check packages/sdk/src/idl/norr_*.ts
  for (const [name, id] of Object.entries(canonicalIds)) {
    const idlSrc = readFileSync(resolve(repoRoot, `packages/sdk/src/idl/${name}.ts`), "utf8");
    assert.ok(
      idlSrc.includes(`"address": "${id}"`),
      `IDL ${name} address mismatch`
    );
  }

  // 5. Check apps/web/src/lib/config.ts
  const configSrc = readFileSync(resolve(repoRoot, "apps/web/src/lib/config.ts"), "utf8");
  for (const [name, id] of Object.entries(canonicalIds)) {
    const short = name.replace("norr_", "");
    assert.ok(
      configSrc.includes(`${short}: "${id}"`),
      `apps/web config ${short} mismatch`
    );
  }
});
