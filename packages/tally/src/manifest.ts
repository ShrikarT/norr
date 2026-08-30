import { allocationLeaf, bytesToHex, MerkleTree, refundLeaf, type MerkleProof } from "../../sdk/src/index.js";
import { canonicalJson, sha256Hex } from "./canonical.js";

export type AcceptedContribution = Readonly<{ ordinal: number; signature: string; instructionIndex: number; contributor: string; entryHash: string; auditorEpoch: number; decryptedAmount: bigint }>;
export type Allocation = Readonly<{ claimant: string; amount: bigint }>;
export type ManifestKind = "allocation" | "refund";
export type TallyManifest = Readonly<{
  schema: "norr-tally-v1"; kind: ManifestKind; clusterGenesisHash: string; programId: string; sale: string; mint: string;
  contributionCount: number; contributionChainHead: string; algorithm: string; entries: readonly Readonly<{ ordinal: number; signature: string; instructionIndex: number; contributor: string; entryHash: string; auditorEpoch: number; amount: string }>[];
  allocations: readonly Readonly<{ claimant: string; amount: string; proof: readonly string[] }>[];
  totalContributed: string; totalAllocated: string; root: string;
}>;

function checkedTotal(values: readonly bigint[]): bigint {
  const total = values.reduce((sum, value) => sum + value, 0n);
  if (values.some((value) => value < 0n || value > ((1n << 64n) - 1n)) || total > ((1n << 64n) - 1n)) throw new RangeError("manifest total outside u64");
  return total;
}

export function buildManifest(args: Readonly<{ kind: ManifestKind; clusterGenesisHash: string; programId: string; sale: string; mint: string; contributionChainHead: string; entries: readonly AcceptedContribution[]; allocations: readonly Allocation[] }>): Readonly<{ manifest: TallyManifest; canonical: string; sha256: string }> {
  const entries = [...args.entries].sort((a, b) => a.ordinal - b.ordinal);
  entries.forEach((entry, index) => { if (entry.ordinal !== index) throw new Error("ContributionSequenceMismatch"); });
  const allocations = [...args.allocations].sort((a, b) => a.claimant.localeCompare(b.claimant));
  if (new Set(allocations.map((entry) => entry.claimant)).size !== allocations.length) throw new Error("duplicate claimant");
  const leaves = allocations.map((entry) => args.kind === "allocation"
    ? allocationLeaf({ programId: args.programId, sale: args.sale, projectMint: args.mint, claimant: entry.claimant, allocation: entry.amount })
    : refundLeaf({ programId: args.programId, sale: args.sale, settlementMint: args.mint, claimant: entry.claimant, refund: entry.amount }));
  const tree = new MerkleTree(leaves);
  const proofHex = (proof: MerkleProof) => proof.map(bytesToHex);
  const manifest: TallyManifest = {
    schema: "norr-tally-v1", kind: args.kind, clusterGenesisHash: args.clusterGenesisHash, programId: args.programId,
    sale: args.sale, mint: args.mint, contributionCount: entries.length, contributionChainHead: args.contributionChainHead,
    algorithm: args.kind === "allocation" ? "norr-claim-v1/double-keccak/sorted-pairs" : "norr-refund-v1/double-keccak/sorted-pairs",
    entries: entries.map(({ ordinal, signature, instructionIndex, contributor, entryHash, auditorEpoch, decryptedAmount }) => ({ ordinal, signature, instructionIndex, contributor, entryHash, auditorEpoch, amount: decryptedAmount.toString() })),
    allocations: allocations.map((entry, index) => ({ claimant: entry.claimant, amount: entry.amount.toString(), proof: proofHex(tree.proof(index)) })),
    totalContributed: checkedTotal(entries.map((entry) => entry.decryptedAmount)).toString(),
    totalAllocated: checkedTotal(allocations.map((entry) => entry.amount)).toString(), root: bytesToHex(tree.root),
  };
  const text = canonicalJson(manifest);
  return { manifest, canonical: text, sha256: sha256Hex(text) };
}
