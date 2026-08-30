import assert from "node:assert/strict";
import test from "node:test";
import { TransactionPlan, type TransactionTransport } from "../src/index.js";

test("TransactionPlan execution halts and records error on simulation failure", async () => {
  const steps = [
    { id: "step-1", label: "Step 1", instructions: ["ix1"] },
    { id: "step-2", label: "Step 2", instructions: ["ix2"], dependsOn: ["step-1"] },
  ];
  const plan = new TransactionPlan(steps);

  const mockTransport: TransactionTransport<string> = {
    async simulate(ixs) {
      if (ixs.includes("ix1")) {
        return { ok: false, consumedComputeUnits: 5000, logs: ["Simulation failed"], error: "InstructionError" };
      }
      return { ok: true, consumedComputeUnits: 2000, logs: [] };
    },
    async signSendConfirm() {
      return "sig123";
    }
  };

  const updates: any[] = [];
  await assert.rejects(async () => {
    await plan.execute(mockTransport, new Set(), (id, u) => updates.push({ id, ...u }));
  }, /InstructionError/);

  const failedUpdate = updates.find((u) => u.stage === "failed");
  assert.ok(failedUpdate);
  assert.equal(failedUpdate.error, "InstructionError");
  assert.equal(failedUpdate.consumedComputeUnits, 5000);
});

test("TransactionPlan executes linearly through successful steps", async () => {
  const steps = [
    { id: "step-1", label: "Step 1", instructions: ["ix1"] },
    { id: "step-2", label: "Step 2", instructions: ["ix2"], dependsOn: ["step-1"] },
  ];
  const plan = new TransactionPlan(steps);

  const mockTransport: TransactionTransport<string> = {
    async simulate() {
      return { ok: true, consumedComputeUnits: 3000, logs: [] };
    },
    async signSendConfirm(ixs, onCommitment) {
      onCommitment("confirmed", "sigConfirmed");
      return "sigFinalized";
    }
  };

  const completed = await plan.execute(mockTransport, new Set(), () => {});
  assert.equal(completed.size, 2);
  assert.ok(completed.has("step-1"));
  assert.ok(completed.has("step-2"));
});
