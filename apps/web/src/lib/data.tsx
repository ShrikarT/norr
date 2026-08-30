import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { Connection } from "@solana/web3.js";

export type Launch = Readonly<{
  id: string;
  name: string;
  symbol: string;
  model: "instant" | "raise";
  state: "live" | "setup" | "sealed" | "settled";
  creator: string;
  desk?: string;
  description: string;
  price?: string;
  marketCap?: string;
  liquidity?: string;
  target?: string;
  progress?: number;
  unlock?: string;
  splits: readonly Readonly<{ name: string; bps: number; role: string; recipient?: string }>[];
}>;

export type Board = Readonly<{
  slug: string;
  name: string;
  owner: string;
  minBps: number;
  launchCount: number;
  allowlistOnly: boolean;
}>;

export type AppData = Readonly<{
  cluster: string;
  genesisHash: string;
  slot: string | null;
  commitment: "processed" | "confirmed" | "finalized" | "unavailable";
  indexer: "online" | "degraded" | "offline";
  launches: readonly Launch[];
  boards: readonly Board[];
  rpcUrl: string;
  rpcConnected: boolean;
  rpcError?: string | undefined;
}>;

const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const DEFAULT_RPC = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SOLANA_RPC_URL) || "https://api.devnet.solana.com";

const verifiedLaunches: readonly Launch[] = [
  {
    id: "alpha",
    name: "Northstar Compute",
    symbol: "NSTAR",
    model: "instant",
    state: "live",
    creator: "FWvsL5EBeQCSDHsTT5mmaohTGrdVZq88jY6uzASUKAfV",
    desk: "frontier",
    description: "Open compute coordination with a fixed project supply and public USDC bonding curve.",
    price: "0.0374",
    marketCap: "$2.46M",
    liquidity: "$184.2K",
    target: "$250K",
    progress: 74,
    unlock: "16 Mar 2027",
    splits: [
      { name: "Creator", bps: 7000, role: "creator", recipient: "FWvsL5EBeQCSDHsTT5mmaohTGrdVZq88jY6uzASUKAfV" },
      { name: "Frontier desk", bps: 1500, role: "partner", recipient: "67mL4D2ukz34urzrygPgTiLkiz7XYdWR4DJ6cYtfv2AJ" },
      { name: "Treasury", bps: 1500, role: "treasury", recipient: "8oc1FUKYsxmxuNxu5sMQXPQDS7LHPuTcQqHGeGysSRzY" },
    ],
  },
  {
    id: "quiet",
    name: "Quiet Harbour",
    symbol: "QHBR",
    model: "raise",
    state: "setup",
    creator: "HKrZcotGz9MCJz1yLzBq4Cd6mYFViNb8iCgtY3gTRSMm",
    desk: "commons",
    description: "A sealed-amount raise configured with Token-2022 confidential transfer extension on Devnet.",
    target: "private while open",
    splits: [
      { name: "Creator", bps: 7600, role: "creator" },
      { name: "Commons", bps: 1500, role: "partner" },
      { name: "Rewards", bps: 900, role: "treasury" },
    ],
  },
  {
    id: "orbit",
    name: "Orbit Materials",
    symbol: "ORBT",
    model: "instant",
    state: "settled",
    creator: "4sJH9wRtDnuMRnuDWvsf7ZgXBMQy5BXgWkgRWbSwMzZ",
    description: "Materials research coordination, graduated into a locked liquidity position.",
    price: "0.1182",
    marketCap: "$7.80M",
    liquidity: "$612.0K",
    target: "$500K",
    progress: 100,
    unlock: "permanent",
    splits: [
      { name: "Creator", bps: 8200, role: "creator" },
      { name: "Liquidity", bps: 1000, role: "partner" },
      { name: "Treasury", bps: 800, role: "treasury" },
    ],
  },
];

const verifiedBoards: readonly Board[] = [
  {
    slug: "frontier",
    name: "Frontier Desk",
    owner: "FWvsL5EBeQCSDHsTT5mmaohTGrdVZq88jY6uzASUKAfV",
    minBps: 1500,
    launchCount: 12,
    allowlistOnly: true,
  },
  {
    slug: "commons",
    name: "Commons Desk",
    owner: "67mL4D2ukz34urzrygPgTiLkiz7XYdWR4DJ6cYtfv2AJ",
    minBps: 1000,
    launchCount: 8,
    allowlistOnly: false,
  },
];

const DataContext = createContext<AppData>({
  cluster: "devnet",
  genesisHash: DEVNET_GENESIS,
  slot: null,
  commitment: "unavailable",
  indexer: "offline",
  launches: verifiedLaunches,
  boards: verifiedBoards,
  rpcUrl: DEFAULT_RPC,
  rpcConnected: false,
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<AppData["commitment"]>("unavailable");
  const [rpcConnected, setRpcConnected] = useState(false);
  const [rpcError, setRpcError] = useState<string | undefined>(undefined);
  const [indexerStatus, setIndexerStatus] = useState<AppData["indexer"]>("offline");

  useEffect(() => {
    let active = true;
    const connection = new Connection(DEFAULT_RPC, "confirmed");

    async function pollRpc() {
      try {
        const currentSlot = await connection.getSlot("confirmed");
        if (active) {
          setSlot(currentSlot.toLocaleString());
          setCommitment("confirmed");
          setRpcConnected(true);
          setRpcError(undefined);
        }
      } catch (err: any) {
        if (active) {
          setRpcConnected(false);
          setRpcError(err?.message || "RPC connection failed");
          setCommitment("unavailable");
        }
      }
    }

    async function checkIndexer() {
      try {
        const resp = await fetch("http://127.0.0.1:8787/health");
        if (resp.ok && active) {
          setIndexerStatus("online");
        } else if (active) {
          setIndexerStatus("degraded");
        }
      } catch {
        if (active) setIndexerStatus("offline");
      }
    }

    pollRpc();
    checkIndexer();
    const timer = setInterval(() => {
      pollRpc();
      checkIndexer();
    }, 10000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const value = useMemo<AppData>(
    () => ({
      cluster: "devnet",
      genesisHash: DEVNET_GENESIS,
      slot,
      commitment,
      indexer: indexerStatus,
      launches: verifiedLaunches,
      boards: verifiedBoards,
      rpcUrl: DEFAULT_RPC,
      rpcConnected,
      rpcError,
    }),
    [slot, commitment, indexerStatus, rpcConnected, rpcError]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
