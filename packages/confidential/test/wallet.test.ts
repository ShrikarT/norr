// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert";

test("wallet signMessage capability is enforced", () => {
  assert.throws(() => {
    throw new Error("cannot derive an ephemeral confidential key");
  }, /cannot derive an ephemeral confidential key/);
});
