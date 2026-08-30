import assert from "node:assert/strict";
import test from "node:test";
import { verifyP0Report, assertConfidentialCapability, type P0Report } from "../src/index.js";

test("verifyP0Report rejects simulated, fake, or missing reports", () => {
  assert.equal(verifyP0Report(null), false);
  assert.equal(verifyP0Report(undefined), false);

  const simulatedReport: P0Report = {
    schema: "norr-p0-v1",
    clusterGenesisHash: "dummy-genesis-hash",
    solanaVersion: "1.18.0",
    token2022Program: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    zkProofProgram: "ZkE1Gama1Proof11111111111111111111111111111",
    setup: { mintId: "fake", saleId: "fake" },
    transactions: { contribute: { signature: "fake", computeUnits: 1000, transactionSize: 500 } },
    keyCeremonyOutputs: { auditorPubkey: "fake" },
    isSimulated: true,
  };
  assert.equal(verifyP0Report(simulatedReport), false);
});

test("assertConfidentialCapability throws P0Required when report is invalid", () => {
  assert.throws(() => {
    assertConfidentialCapability(null);
  }, /P0Required/);
});
