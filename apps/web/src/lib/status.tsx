import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { CT_EVIDENCE, DEVNET_GENESIS, INDEXER_URL, PROGRAM_IDS, getRpcUrl, type ProgramKey } from "./config";

export type ClusterIdentity = "devnet" | "mainnet" | "testnet" | "unknown";

export type CtEvidenceStatus = Readonly<{
  checked: boolean;
  mintLive: boolean;
  accountLive: boolean;
  proofContextsLive: number; // 0..3
}>;

export type ClusterStatus = Readonly<{
  rpcUrl: string;
  connected: boolean;
  /** false until the first heartbeat resolves either way */
  probed: boolean;
  rpcError: string | null;
  genesisHash: string | null;
  identity: ClusterIdentity;
  isDevnet: boolean;
  slot: number | null;
  epoch: number | null;
  programsDeployed: Readonly<Record<ProgramKey, boolean>> | null;
  deployedCount: number;
  ctEvidence: CtEvidenceStatus;
  indexer: "online" | "offline" | "unconfigured";
  connection: Connection;
  refresh: () => void;
}>;

const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const TESTNET_GENESIS = "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY";

function identify(genesis: string | null): ClusterIdentity {
  if (genesis === DEVNET_GENESIS) return "devnet";
  if (genesis === MAINNET_GENESIS) return "mainnet";
  if (genesis === TESTNET_GENESIS) return "testnet";
  return "unknown";
}

const PROGRAM_KEYS = Object.keys(PROGRAM_IDS) as ProgramKey[];

const ClusterContext = createContext<ClusterStatus | null>(null);

export function ClusterProvider({ children }: { children: ReactNode }) {
  const rpcUrl = getRpcUrl();
  const connection = useMemo(() => new Connection(rpcUrl, "confirmed"), [rpcUrl]);
  const [connected, setConnected] = useState(false);
  const [probed, setProbed] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [genesisHash, setGenesisHash] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [epoch, setEpoch] = useState<number | null>(null);
  const [programsDeployed, setProgramsDeployed] = useState<Record<ProgramKey, boolean> | null>(null);
  const [ctEvidence, setCtEvidence] = useState<CtEvidenceStatus>({
    checked: false,
    mintLive: false,
    accountLive: false,
    proofContextsLive: 0,
  });
  const [indexer, setIndexer] = useState<ClusterStatus["indexer"]>(INDEXER_URL ? "offline" : "unconfigured");
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  // Slot heartbeat — the cheap poll that drives the connected indicator.
  // A single transient failure (e.g. a 429 from the public endpoint) does not
  // flip the indicator; two consecutive failures do.
  useEffect(() => {
    let active = true;
    let failures = 0;
    async function beat() {
      try {
        const s = await connection.getSlot("confirmed");
        if (!active) return;
        failures = 0;
        setProbed(true);
        setSlot(s);
        setConnected(true);
        setRpcError(null);
      } catch (err) {
        if (!active) return;
        failures += 1;
        setProbed(true);
        if (failures >= 2) {
          setConnected(false);
          setRpcError(err instanceof Error ? err.message : "RPC request failed");
        }
      }
    }
    beat();
    const timer = setInterval(beat, 12_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connection, nonce]);

  // One-shot identity + deployment probes (re-run on refresh()).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [genesis, epochInfo] = await Promise.all([
          connection.getGenesisHash(),
          connection.getEpochInfo("confirmed"),
        ]);
        if (!active) return;
        setGenesisHash(genesis);
        setEpoch(epochInfo.epoch);
      } catch {
        if (active) setGenesisHash(null);
      }
      try {
        const keys = PROGRAM_KEYS.map((k) => new PublicKey(PROGRAM_IDS[k]));
        const infos = await connection.getMultipleAccountsInfo(keys);
        if (!active) return;
        const map = {} as Record<ProgramKey, boolean>;
        PROGRAM_KEYS.forEach((k, i) => {
          map[k] = Boolean(infos[i]?.executable);
        });
        setProgramsDeployed(map);
      } catch {
        if (active) setProgramsDeployed(null);
      }
      try {
        const ctKeys = [
          CT_EVIDENCE.mint,
          CT_EVIDENCE.tokenAccount,
          CT_EVIDENCE.equalityProofContext,
          CT_EVIDENCE.validityProofContext,
          CT_EVIDENCE.rangeProofContext,
        ].map((a) => new PublicKey(a));
        const infos = await connection.getMultipleAccountsInfo(ctKeys);
        if (!active) return;
        setCtEvidence({
          checked: true,
          mintLive: Boolean(infos[0]),
          accountLive: Boolean(infos[1]),
          proofContextsLive: infos.slice(2).filter(Boolean).length,
        });
      } catch {
        if (active) setCtEvidence((prev) => ({ ...prev, checked: true }));
      }
      if (INDEXER_URL) {
        try {
          const resp = await fetch(`${INDEXER_URL}/health`, { signal: AbortSignal.timeout(4000) });
          if (active) setIndexer(resp.ok ? "online" : "offline");
        } catch {
          if (active) setIndexer("offline");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [connection, nonce]);

  const identity = identify(genesisHash);
  const deployedCount = programsDeployed ? PROGRAM_KEYS.filter((k) => programsDeployed[k]).length : 0;

  const value = useMemo<ClusterStatus>(
    () => ({
      rpcUrl,
      connected,
      probed,
      rpcError,
      genesisHash,
      identity,
      isDevnet: identity === "devnet",
      slot,
      epoch,
      programsDeployed,
      deployedCount,
      ctEvidence,
      indexer,
      connection,
      refresh,
    }),
    [rpcUrl, connected, probed, rpcError, genesisHash, identity, slot, epoch, programsDeployed, deployedCount, ctEvidence, indexer, connection, refresh]
  );

  return <ClusterContext.Provider value={value}>{children}</ClusterContext.Provider>;
}

export function useCluster(): ClusterStatus {
  const ctx = useContext(ClusterContext);
  if (!ctx) throw new Error("useCluster requires ClusterProvider");
  return ctx;
}
