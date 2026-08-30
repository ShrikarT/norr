import assert from "node:assert/strict";
import test from "node:test";
import { allocationLeaf, encodeBase58, MerkleTree, refundLeaf, verifyMerkleProof } from "../src/index.ts";

const address = (fill: number) => encodeBase58(new Uint8Array(32).fill(fill));

test("claim and refund domains cannot cross", () => {
  const programId = address(1), sale = address(2), mint = address(3);
  const claimants = [address(4), address(5), address(6)];
  const leaves = claimants.map((claimant, index) => allocationLeaf({ programId, sale, projectMint: mint, claimant, allocation: BigInt(index + 1) * 10n }));
  const tree = new MerkleTree(leaves);
  claimants.forEach((claimant, index) => {
    assert.equal(verifyMerkleProof(leaves[index]!, tree.proof(index), tree.root), true);
    const refund = refundLeaf({ programId, sale, settlementMint: mint, claimant, refund: BigInt(index + 1) * 10n });
    assert.equal(verifyMerkleProof(refund, tree.proof(index), tree.root), false);
  });
});

test("depth is capped at twenty", () => {
  const leaf = new Uint8Array(32);
  assert.equal(verifyMerkleProof(leaf, new Array(21).fill(leaf), leaf), false);
});
