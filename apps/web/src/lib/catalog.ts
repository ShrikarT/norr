/**
 * Reference catalog.
 *
 * The norr programs are not yet deployed to a public cluster, so there are no
 * live launch or desk accounts to index. These records exist to demonstrate
 * the product surfaces and the exact curve arithmetic; every view that renders
 * them labels them as reference parameters, never as cluster state. When the
 * deployment probe finds live programs, real accounts replace this catalog.
 */

export type LaunchModel = "instant" | "raise";
export type LaunchState = "draft" | "live" | "sealed" | "settled";

export type Split = Readonly<{ name: string; bps: number; role: "creator" | "partner" | "treasury" }>;

export type CurveParams = Readonly<{
  /** virtual base reserve, USDC atomic units (6 dp) */
  virtualBase: bigint;
  /** real base reserve, USDC atomic units */
  baseReserve: bigint;
  /** project token reserve, atomic units (9 dp) */
  tokenReserve: bigint;
  feeBps: number;
}>;

export type CatalogLaunch = Readonly<{
  id: string;
  name: string;
  symbol: string;
  model: LaunchModel;
  state: LaunchState;
  desk?: string;
  description: string;
  supply: string;
  curve?: CurveParams;
  splits: readonly Split[];
}>;

export type CatalogDesk = Readonly<{
  slug: string;
  name: string;
  minBps: number;
  allowlistOnly: boolean;
  description: string;
}>;

export const SAMPLE_LAUNCHES: readonly CatalogLaunch[] = [
  {
    id: "norr-genesis",
    name: "Norr Protocol Token",
    symbol: "NORR",
    model: "instant",
    state: "live",
    desk: "defi-384473",
    description:
      "Official live on-chain token launch on Solana Devnet. Fixed project supply with fee routing and constant-product curve.",
    supply: "1,000,000,000",
    curve: {
      virtualBase: 30_000_000_000n,
      baseReserve: 0n,
      tokenReserve: 1_000_000_000_000_000_000n,
      feeBps: 100,
    },
    splits: [
      { name: "Creator", bps: 10000, role: "creator" },
    ],
  },
  {
    id: "northstar",
    name: "Northstar Compute",
    symbol: "NSTAR",
    model: "instant",
    state: "draft",
    desk: "frontier",
    description:
      "Open compute coordination. Fixed project supply on a public USDC constant-product curve; every trade routes fees through the split router.",
    supply: "1,000,000,000",
    curve: {
      virtualBase: 30_000_000_000n,
      baseReserve: 0n,
      tokenReserve: 1_000_000_000_000_000_000n,
      feeBps: 100,
    },
    splits: [
      { name: "Creator", bps: 7000, role: "creator" },
      { name: "Frontier desk", bps: 1500, role: "partner" },
      { name: "Protocol treasury", bps: 1500, role: "treasury" },
    ],
  },
  {
    id: "quiet-harbour",
    name: "Quiet Harbour",
    symbol: "QHBR",
    model: "raise",
    state: "draft",
    desk: "commons",
    description:
      "A sealed-amount raise. Contribution sizes stay encrypted under Token-2022 confidential transfers while the raise is open; settlement is a public Merkle claim.",
    supply: "250,000,000",
    splits: [
      { name: "Creator", bps: 7600, role: "creator" },
      { name: "Commons desk", bps: 1500, role: "partner" },
      { name: "Contributor rewards", bps: 900, role: "treasury" },
    ],
  },
  {
    id: "orbit",
    name: "Orbit Materials",
    symbol: "ORBT",
    model: "instant",
    state: "draft",
    description:
      "Materials research coordination with a permanently locked liquidity position at graduation.",
    supply: "500,000,000",
    curve: {
      virtualBase: 12_000_000_000n,
      baseReserve: 0n,
      tokenReserve: 500_000_000_000_000_000n,
      feeBps: 100,
    },
    splits: [
      { name: "Creator", bps: 8200, role: "creator" },
      { name: "Liquidity lock", bps: 1000, role: "partner" },
      { name: "Protocol treasury", bps: 800, role: "treasury" },
    ],
  },
];

export const SAMPLE_DESKS: readonly CatalogDesk[] = [
  {
    slug: "defi-384473",
    name: "Solana DeFi Desk",
    minBps: 250,
    allowlistOnly: false,
    description: "Live on-chain curation desk created on Solana Devnet (norr-boards). Open allowlist for builders.",
  },
  {
    slug: "frontier",
    name: "Frontier desk",
    minBps: 1500,
    allowlistOnly: true,
    description: "Deep-tech launches curated by operators. Attached raises lock a 15% minimum revenue share to the desk.",
  },
  {
    slug: "commons",
    name: "Commons desk",
    minBps: 1000,
    allowlistOnly: false,
    description: "Open community desk. Any creator can attach; the 10% minimum share is snapshotted at attach time.",
  },
];
