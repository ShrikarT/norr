import assert from "node:assert/strict";
import test from "node:test";
import { encodeBase58 } from "../../sdk/src/index.ts";
import { buildManifest } from "../src/index.ts";
const address = (fill: number) => encodeBase58(new Uint8Array(32).fill(fill));
test("manifest output is deterministic and sequence-bound", () => {
  const input = {
    kind: "allocation" as const, clusterGenesisHash: "genesis", programId: address(1), sale: address(2), mint: address(3), contributionChainHead: "00".repeat(32),
    entries: [{ ordinal: 0, signature: "sig", instructionIndex: 1, contributor: address(4), entryHash: "11".repeat(32), auditorEpoch: 0, decryptedAmount: 10n }],
    allocations: [{ claimant: address(4), amount: 20n }],
  };
  const one = buildManifest(input), two = buildManifest(input);
  assert.equal(one.canonical, two.canonical); assert.equal(one.sha256, two.sha256);
  assert.throws(() => buildManifest({ ...input, entries: [{ ...input.entries[0]!, ordinal: 1 }] }), /ContributionSequenceMismatch/);
});
