import assert from "node:assert/strict";
import test from "node:test";
import { accrueDelta, ceilDiv, priceQ64, quoteBuy, quoteSell, formatProjectPrice } from "../src/index.ts";

test("ceilDiv is exact at and around divisibility", () => {
  assert.equal(ceilDiv(10n, 5n), 2n);
  assert.equal(ceilDiv(11n, 5n), 3n);
  assert.throws(() => ceilDiv(1n, 0n));
});

test("curve reserve product never falls because of rounding", () => {
  let seed = 0x1234_5678n;
  const next = () => { seed = (seed * 1_103_515_245n + 12_345n) & 0x7fff_ffffn; return seed; };
  for (let index = 0; index < 2_000; index += 1) {
    const virtualBase = 1_000_000n + next();
    const baseReserve = next();
    const tokenReserve = 1_000_000_000n + next() * 100n;
    const input = 1n + next() % 1_000_000n;
    const before = (virtualBase + baseReserve) * tokenReserve;
    const buy = quoteBuy({ virtualBase, baseReserve, tokenReserve, baseIn: input, feeBps: 30 });
    assert.ok((virtualBase + baseReserve + buy.net) * buy.newTokenReserve >= before);
    const sell = quoteSell({ virtualBase, baseReserve: baseReserve + 1_000_000n, tokenReserve, tokensIn: input, feeBps: 30 });
    assert.ok(sell.newEffectiveBase * (tokenReserve + input) >= (virtualBase + baseReserve + 1_000_000n) * tokenReserve);
  }
});

test("Q64 price accounts for 9/6 decimal mismatch", () => {
  const q64 = priceQ64(1_000_000n, 1_000_000_000n);
  assert.equal(formatProjectPrice(q64, 6), "0.999999");
});

test("per-delta fee accrual is monotonic and exact", () => {
  let splits = [
    { recipient: "creator", bps: 7000, category: 0, accrued: 0n, released: 0n },
    { recipient: "desk", bps: 2000, category: 1, accrued: 0n, released: 0n },
    { recipient: "treasury", bps: 1000, category: 6, accrued: 0n, released: 0n },
  ];
  let total = 0n;
  for (const delta of [1n, 7n, 13n, 101n, 999_999n]) {
    const previous = splits.map((entry) => entry.accrued);
    splits = [...accrueDelta(splits, delta)];
    total += delta;
    assert.equal(splits.reduce((sum, entry) => sum + entry.accrued, 0n), total);
    splits.forEach((entry, index) => assert.ok(entry.accrued >= previous[index]!));
  }
});
