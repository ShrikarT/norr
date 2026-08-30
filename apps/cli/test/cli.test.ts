import assert from "node:assert/strict";
import test from "node:test";
import { executeCli } from "../src/index.js";

test("CLI prints help with all supported commands", async () => {
  const result = await executeCli(["--help"]);
  assert.equal(result.code, 0);
  assert.ok(result.stdout.includes("norr operator CLI"));
  assert.ok(result.stdout.includes("token:create"));
  assert.ok(result.stdout.includes("market:buy"));
});

test("CLI enforces P0Required gate for private commands when P0_REPORT_PATH is missing", async () => {
  const result = await executeCli(["confidential:transfer", "-a", "100"], {});
  assert.equal(result.code, 3);
  assert.ok(result.stderr.includes("P0Required"));
});

test("CLI market quote returns valid integer arithmetic", async () => {
  const result = await executeCli(["market:quote", "--baseIn", "100000"]);
  assert.equal(result.code, 0);
  assert.ok(result.stdout.includes("Tokens Out:"));
  assert.ok(result.stdout.includes("Fee: 300"));
});
