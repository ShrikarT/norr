import assert from "node:assert/strict";
import test from "node:test";
import { safeJson } from "../scripts/safe-json.ts";

test("safeJson prints RPC InstructionError bigints without throwing", () => {
  const err = { InstructionError: [0n, { Custom: 27n }] };
  assert.equal(safeJson(err), '{"InstructionError":["0n",{"Custom":"27n"}]}');
  assert.equal(safeJson(null), "null");
  assert.equal(safeJson({ ok: true }), '{"ok":true}');
});

test("safeJson does not coerce non-bigint protocol fields", () => {
  const data = { amount: 10000, hex: "abcd" };
  assert.equal(safeJson(data), JSON.stringify(data));
});
