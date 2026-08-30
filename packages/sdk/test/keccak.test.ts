import assert from "node:assert/strict";
import test from "node:test";
import { keccakHex, utf8 } from "../src/index.ts";

test("keccak-256 matches canonical vectors", () => {
  assert.equal(keccakHex(new Uint8Array()), "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  assert.equal(keccakHex(utf8("abc")), "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45");
});
