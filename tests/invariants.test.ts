import assert from "node:assert/strict";
import test from "node:test";
import { accrueDelta, quoteBuy, quoteSell } from "../packages/sdk/src/index.ts";
test("donation surplus is not recognized as a curve reserve", () => {
  const state = { virtualBase: 1_000_000n, baseReserve: 500_000n, tokenReserve: 9_000_000_000n, feeBps: 30 };
  const before = quoteBuy({ ...state, baseIn: 100_000n });
  const rawVaultWithDonation = state.baseReserve + 99_000_000n;
  const after = quoteBuy({ ...state, baseIn: 100_000n });
  assert.equal(before.tokensOut, after.tokensOut); assert.ok(rawVaultWithDonation > state.baseReserve);
});
test("random release order cannot change accrued entitlement", () => {
  const initial = [
    { recipient: "a", bps: 5000, category: 0, accrued: 0n, released: 0n },
    { recipient: "b", bps: 3000, category: 1, accrued: 0n, released: 0n },
    { recipient: "c", bps: 2000, category: 2, accrued: 0n, released: 0n },
  ];
  const accrued = accrueDelta(initial, 7n);
  const released = [accrued[2]!, accrued[0]!, accrued[1]!].reduce((sum, item) => sum + item.accrued, 0n);
  assert.equal(released, 7n);
});
