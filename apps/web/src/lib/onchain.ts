import { useEffect, useState, useCallback, useMemo } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { decodeLaunchAccount, decodeBoardAccount, decodeCurveAccount, type OnchainLaunch, type OnchainBoard, type OnchainCurve } from "@norr/sdk";
import { PROGRAM_IDS } from "./config";
import { SAMPLE_LAUNCHES, SAMPLE_DESKS, type CatalogLaunch, type CatalogDesk, type CurveParams } from "./catalog";
import { useCluster } from "./status";

export type LiveCatalogLaunch = CatalogLaunch & {
  onchain?: OnchainLaunch | undefined;
  curveAccount?: OnchainCurve | undefined;
  isLiveOnChain: boolean;
  address?: string | undefined;
  creator?: string | undefined;
  projectMint?: string | undefined;
  salePda?: string | undefined;
  routerPda?: string | undefined;
  curvePda?: string | undefined;
};

export type LiveCatalogDesk = CatalogDesk & {
  onchain?: OnchainBoard | undefined;
  isLiveOnChain: boolean;
  address?: string | undefined;
  owner?: string | undefined;
};

const LOCAL_LAUNCHES_KEY = "norr.created_launches";

export function getCachedLaunches(): OnchainLaunch[] {
  try {
    const raw = localStorage.getItem(LOCAL_LAUNCHES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function cacheCreatedLaunch(launch: OnchainLaunch): void {
  try {
    const existing = getCachedLaunches().filter((l) => l.address !== launch.address);
    localStorage.setItem(LOCAL_LAUNCHES_KEY, JSON.stringify([launch, ...existing].slice(0, 20)));
  } catch {
    /* ignore */
  }
}

function onchainLaunchToCatalog(
  launch: OnchainLaunch,
  curveMap: Map<string, OnchainCurve>,
  boardMap: Map<string, OnchainBoard>
): LiveCatalogLaunch {
  const curveAcc = curveMap.get(launch.curve) || curveMap.get(launch.projectMint);
  const boardAcc = boardMap.get(launch.board);

  const curveParams: CurveParams = curveAcc
    ? {
        virtualBase: curveAcc.virtualBase,
        baseReserve: curveAcc.baseReserve,
        tokenReserve: curveAcc.tokenReserve,
        feeBps: curveAcc.feeBps,
      }
    : {
        virtualBase: 30_000_000_000n,
        baseReserve: 0n,
        tokenReserve: 1_000_000_000_000_000_000n,
        feeBps: 100,
      };

  return {
    id: launch.address,
    name: launch.name || "Untitled Launch",
    symbol: launch.symbol || "TOKEN",
    model: launch.model,
    state: "live",
    desk: boardAcc?.slug ?? (launch.board !== "11111111111111111111111111111111" ? launch.board.slice(0, 8) : undefined),
    description:
      launch.uri && launch.uri.startsWith("http")
        ? `Live on-chain launch verified on Solana Devnet. Mint: ${launch.projectMint.slice(0, 6)}…${launch.projectMint.slice(-4)}`
        : "Live on-chain token launch on Solana Devnet.",
    supply: "1,000,000,000",
    curve: curveParams,
    splits: [{ name: "Creator", bps: 10000, role: "creator" }],
    onchain: launch,
    curveAccount: curveAcc,
    isLiveOnChain: true,
    address: launch.address,
    creator: launch.creator,
    projectMint: launch.projectMint,
    salePda: launch.sale,
    routerPda: launch.router,
    curvePda: launch.curve,
  };
}

function onchainBoardToCatalog(board: OnchainBoard): LiveCatalogDesk {
  return {
    slug: board.slug,
    name: board.name,
    minBps: board.minBps,
    allowlistOnly: board.allowlistOnly,
    description: board.uri || "Live on-chain curation desk created on Solana Devnet (norr-boards).",
    onchain: board,
    isLiveOnChain: true,
    address: board.address,
    owner: board.owner,
  };
}

export function useLiveLaunches() {
  const c = useCluster();
  const [launches, setLaunches] = useState<readonly LiveCatalogLaunch[]>(
    SAMPLE_LAUNCHES.map((s) => ({ ...s, isLiveOnChain: false }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      const localCached = getCachedLaunches();

      try {
        const launchProgramKey = new PublicKey(PROGRAM_IDS.launch);
        const boardProgramKey = new PublicKey(PROGRAM_IDS.boards);
        const marketProgramKey = new PublicKey(PROGRAM_IDS.market);

        const [launchAccounts, boardAccounts, curveAccounts] = await Promise.all([
          c.connection.getProgramAccounts(launchProgramKey).catch(() => []),
          c.connection.getProgramAccounts(boardProgramKey).catch(() => []),
          c.connection.getProgramAccounts(marketProgramKey).catch(() => []),
        ]);

        if (!active) return;

        const boardMap = new Map<string, OnchainBoard>();
        for (const b of boardAccounts) {
          const decoded = decodeBoardAccount(b.pubkey.toBase58(), b.account.data);
          if (decoded) {
            boardMap.set(decoded.address, decoded);
            boardMap.set(decoded.slug, decoded);
          }
        }

        const curveMap = new Map<string, OnchainCurve>();
        for (const cv of curveAccounts) {
          const decoded = decodeCurveAccount(cv.pubkey.toBase58(), cv.account.data);
          if (decoded) {
            curveMap.set(decoded.address, decoded);
            curveMap.set(decoded.projectMint, decoded);
            curveMap.set(decoded.launch, decoded);
          }
        }

        const onchainLaunches: OnchainLaunch[] = [];
        const seenAddresses = new Set<string>();

        for (const l of launchAccounts) {
          const decoded = decodeLaunchAccount(l.pubkey.toBase58(), l.account.data);
          if (decoded) {
            onchainLaunches.push(decoded);
            seenAddresses.add(decoded.address);
          }
        }

        for (const cached of localCached) {
          if (!seenAddresses.has(cached.address)) {
            onchainLaunches.push(cached);
            seenAddresses.add(cached.address);
          }
        }

        onchainLaunches.sort((a, b) => b.createdAt - a.createdAt);

        const liveMapped = onchainLaunches.map((l) => onchainLaunchToCatalog(l, curveMap, boardMap));

        const sampleMapped = SAMPLE_LAUNCHES.filter(
          (sample) => !liveMapped.some((live) => live.name === sample.name && live.symbol === sample.symbol)
        ).map((s) => ({ ...s, isLiveOnChain: false }));

        setLaunches([...liveMapped, ...sampleMapped]);
      } catch (err) {
        if (!active) return;
        console.warn("Failed to fetch on-chain launches:", err);
        setError(err instanceof Error ? err.message : "Failed to load live launches");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [c.connection, nonce, c.deployedCount]);

  return { launches, loading, error, refresh };
}

export function useLiveBoards() {
  const c = useCluster();
  const [desks, setDesks] = useState<readonly LiveCatalogDesk[]>(
    SAMPLE_DESKS.map((s) => ({ ...s, isLiveOnChain: false }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    const fetchBoards = async () => {
      setLoading(true);
      setError(null);
      try {
        const boardProgramKey = new PublicKey(PROGRAM_IDS.boards);
        const boardAccounts = await c.connection.getProgramAccounts(boardProgramKey).catch(() => []);
        if (!active) return;

        const onchainBoards: OnchainBoard[] = [];
        const seenSlugs = new Set<string>();

        for (const b of boardAccounts) {
          const decoded = decodeBoardAccount(b.pubkey.toBase58(), b.account.data);
          if (decoded && !seenSlugs.has(decoded.slug)) {
            onchainBoards.push(decoded);
            seenSlugs.add(decoded.slug);
          }
        }

        onchainBoards.sort((a, b) => b.createdAt - a.createdAt);
        const liveMapped = onchainBoards.map(onchainBoardToCatalog);

        const sampleMapped = SAMPLE_DESKS.filter((s) => !seenSlugs.has(s.slug)).map((s) => ({
          ...s,
          isLiveOnChain: false,
        }));

        setDesks([...liveMapped, ...sampleMapped]);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load desks");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchBoards();
    const interval = setInterval(fetchBoards, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [c.connection, nonce, c.deployedCount]);

  return { desks, loading, error, refresh };
}

export function useLaunch(idOrAddress?: string) {
  const { launches, loading: listLoading, refresh } = useLiveLaunches();
  const c = useCluster();
  const [directLaunch, setDirectLaunch] = useState<LiveCatalogLaunch | null>(null);
  const [directLoading, setDirectLoading] = useState(false);

  const match = useMemo(() => {
    if (!idOrAddress) return null;
    const clean = idOrAddress.trim();
    return (
      launches.find(
        (l) =>
          l.id === clean ||
          l.address === clean ||
          l.projectMint === clean ||
          l.symbol.toLowerCase() === clean.toLowerCase()
      ) ?? directLaunch
    );
  }, [launches, idOrAddress, directLaunch]);

  useEffect(() => {
    if (!idOrAddress || match) return;
    let active = true;

    const fetchDirect = async () => {
      try {
        setDirectLoading(true);
        let pubkey: PublicKey | null = null;
        try {
          pubkey = new PublicKey(idOrAddress);
        } catch {
          // not a pubkey
        }

        if (!pubkey) return;

        let accountInfo = await c.connection.getAccountInfo(pubkey);
        let launchAddress = pubkey.toBase58();

        if (!accountInfo || accountInfo.data.length < 100) {
          const [derivedLaunchPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("launch"), pubkey.toBuffer()],
            new PublicKey(PROGRAM_IDS.launch)
          );
          const derivedInfo = await c.connection.getAccountInfo(derivedLaunchPda);
          if (derivedInfo) {
            accountInfo = derivedInfo;
            launchAddress = derivedLaunchPda.toBase58();
          }
        }

        if (!active || !accountInfo) return;

        const decoded = decodeLaunchAccount(launchAddress, accountInfo.data);
        if (!decoded) return;

        let curveAcc: OnchainCurve | null = null;
        try {
          const curveInfo = await c.connection.getAccountInfo(new PublicKey(decoded.curve));
          if (curveInfo) curveAcc = decodeCurveAccount(decoded.curve, curveInfo.data);
        } catch {
          /* ignore */
        }

        const curveMap = new Map<string, OnchainCurve>();
        if (curveAcc) curveMap.set(decoded.curve, curveAcc);

        const mapped = onchainLaunchToCatalog(decoded, curveMap, new Map());
        if (active) setDirectLaunch(mapped);
      } catch (err) {
        console.warn("Direct launch lookup failed:", err);
      } finally {
        if (active) setDirectLoading(false);
      }
    };

    fetchDirect();
    return () => {
      active = false;
    };
  }, [idOrAddress, match, c.connection]);

  return {
    launch: match,
    loading: listLoading || directLoading,
    refresh,
  };
}

export function useDesk(slugOrAddress?: string) {
  const { desks, loading: listLoading, refresh } = useLiveBoards();
  const c = useCluster();
  const [directDesk, setDirectDesk] = useState<LiveCatalogDesk | null>(null);
  const [directLoading, setDirectLoading] = useState(false);

  const match = useMemo(() => {
    if (!slugOrAddress) return null;
    const clean = slugOrAddress.trim().toLowerCase();
    return (
      desks.find((d) => d.slug.toLowerCase() === clean || d.address === slugOrAddress) ?? directDesk
    );
  }, [desks, slugOrAddress, directDesk]);

  useEffect(() => {
    if (!slugOrAddress || match) return;
    let active = true;

    const fetchDirect = async () => {
      try {
        setDirectLoading(true);
        const cleanSlug = slugOrAddress.trim().toLowerCase();
        const [boardPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("board"), Buffer.from(cleanSlug, "utf8")],
          new PublicKey(PROGRAM_IDS.boards)
        );

        const accountInfo = await c.connection.getAccountInfo(boardPda);
        if (!active || !accountInfo) return;

        const decoded = decodeBoardAccount(boardPda.toBase58(), accountInfo.data);
        if (!decoded) return;

        const mapped = onchainBoardToCatalog(decoded);
        if (active) setDirectDesk(mapped);
      } catch (err) {
        console.warn("Direct desk lookup failed:", err);
      } finally {
        if (active) setDirectLoading(false);
      }
    };

    fetchDirect();
    return () => {
      active = false;
    };
  }, [slugOrAddress, match, c.connection]);

  return {
    desk: match,
    loading: listLoading || directLoading,
    refresh,
  };
}