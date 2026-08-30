import { MAX_MERKLE_DEPTH } from "./constants.js";
import { addressBytes, compareBytes, concatBytes, u64le, utf8 } from "./bytes.js";
import { keccak256 } from "./keccak.js";

export type Hash32 = Uint8Array;
export type MerkleProof = readonly Hash32[];

function hashPair(left: Hash32, right: Hash32): Hash32 {
  if (left.length !== 32 || right.length !== 32) throw new RangeError("hash length");
  return keccak256(compareBytes(left, right) <= 0 ? concatBytes(left, right) : concatBytes(right, left));
}
function doubleHash(preimage: Uint8Array): Hash32 { return keccak256(keccak256(preimage)); }

export function allocationLeaf(args: Readonly<{ programId: string; sale: string; projectMint: string; claimant: string; allocation: bigint }>): Hash32 {
  return doubleHash(concatBytes(
    utf8("norr-claim-v1"), addressBytes(args.programId), addressBytes(args.sale),
    addressBytes(args.projectMint), addressBytes(args.claimant), u64le(args.allocation),
  ));
}

export function refundLeaf(args: Readonly<{ programId: string; sale: string; settlementMint: string; claimant: string; refund: bigint }>): Hash32 {
  return doubleHash(concatBytes(
    utf8("norr-refund-v1"), addressBytes(args.programId), addressBytes(args.sale),
    addressBytes(args.settlementMint), addressBytes(args.claimant), u64le(args.refund),
  ));
}

export function contributionEntry(args: Readonly<{ sale: string; ordinal: number; contributor: string; sourceCtAccount: string; auditorEpoch: number; contextHash: Hash32 }>): Hash32 {
  if (args.contextHash.length !== 32) throw new RangeError("context hash");
  const ordinal = new Uint8Array(4); new DataView(ordinal.buffer).setUint32(0, args.ordinal, true);
  const epoch = new Uint8Array(4); new DataView(epoch.buffer).setUint32(0, args.auditorEpoch, true);
  return keccak256(concatBytes(
    utf8("norr-contribution-v1"), addressBytes(args.sale), ordinal, addressBytes(args.contributor),
    addressBytes(args.sourceCtAccount), epoch, args.contextHash,
  ));
}

export function extendContributionChain(previous: Hash32, entry: Hash32): Hash32 {
  if (previous.length !== 32 || entry.length !== 32) throw new RangeError("hash length");
  return keccak256(concatBytes(previous, entry));
}

export class MerkleTree {
  readonly levels: readonly (readonly Hash32[])[];
  constructor(leaves: readonly Hash32[]) {
    if (leaves.length === 0) throw new RangeError("empty Merkle tree");
    if (leaves.some((leaf) => leaf.length !== 32)) throw new RangeError("leaf length");
    const levels: Hash32[][] = [leaves.map((leaf) => leaf.slice())];
    while (levels.at(-1)!.length > 1) {
      const current = levels.at(-1)!;
      const next: Hash32[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i]!;
        const right = current[i + 1] ?? left;
        next.push(hashPair(left, right));
      }
      levels.push(next);
      if (levels.length - 1 > MAX_MERKLE_DEPTH) throw new RangeError("Merkle depth exceeds 20");
    }
    this.levels = levels;
  }
  get root(): Hash32 { return this.levels.at(-1)![0]!.slice(); }
  proof(index: number): MerkleProof {
    if (!Number.isInteger(index) || index < 0 || index >= this.levels[0]!.length) throw new RangeError("leaf index");
    const proof: Hash32[] = [];
    let position = index;
    for (let levelIndex = 0; levelIndex < this.levels.length - 1; levelIndex += 1) {
      const level = this.levels[levelIndex]!;
      proof.push((level[position ^ 1] ?? level[position])!.slice());
      position = Math.floor(position / 2);
    }
    return proof;
  }
}

export function verifyMerkleProof(leaf: Hash32, proof: MerkleProof, root: Hash32): boolean {
  if (leaf.length !== 32 || root.length !== 32 || proof.length > MAX_MERKLE_DEPTH) return false;
  let current = leaf;
  for (const sibling of proof) {
    if (sibling.length !== 32) return false;
    current = hashPair(current, sibling);
  }
  return compareBytes(current, root) === 0;
}
