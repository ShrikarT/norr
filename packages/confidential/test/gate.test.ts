import assert from "node:assert/strict";
import test from "node:test";
import { assertConfidentialCapability } from "../src/index.js";

test("private operations fail closed without a verified P0 report", () => {
  assert.throws(() => {
    assertConfidentialCapability(undefined);
  }, /P0Required/);
});
