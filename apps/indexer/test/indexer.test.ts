import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore } from "../src/memory-store.js";
import type { IndexedEvent } from "../src/types.js";

test("MemoryStore inserts, orders by slot, and queries activity by subject", async () => {
  const store = new MemoryStore();
  const event1: IndexedEvent = {
    slot: 100n,
    signature: "sig1",
    instructionIndex: 0,
    innerIndex: 0,
    program: "market",
    kind: "Trade",
    subject: "Token1111",
    payload: { baseIn: "1000", tokensOut: "5000" },
    finalized: true,
  };
  const event2: IndexedEvent = {
    slot: 105n,
    signature: "sig2",
    instructionIndex: 0,
    innerIndex: 0,
    program: "market",
    kind: "Trade",
    subject: "Token1111",
    payload: { baseIn: "2000", tokensOut: "9500" },
    finalized: false,
  };
  const event3: IndexedEvent = {
    slot: 102n,
    signature: "sig3",
    instructionIndex: 0,
    innerIndex: 0,
    program: "market",
    kind: "Trade",
    subject: "Token2222",
    payload: { baseIn: "500", tokensOut: "2500" },
    finalized: true,
  };

  await store.insert(event1);
  await store.insert(event2);
  await store.insert(event3);

  const checkpoint = await store.finalizedCheckpoint();
  assert.equal(checkpoint, 102n);

  const activity = await store.activity("Token1111", 10);
  assert.equal(activity.length, 2);
  assert.equal(activity[0].slot, 105n);
  assert.equal(activity[1].slot, 100n);

  await store.rewindAfter(100n);
  const afterRewind = await store.activity("Token1111", 10);
  assert.equal(afterRewind.length, 1);
  assert.equal(afterRewind[0].slot, 100n);
});
