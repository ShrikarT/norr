export type ClusterIdentity = Readonly<{ name: string; genesisHash: string; rpcHttp: string; rpcWs: string }>;
export function assertCluster(expected: ClusterIdentity, actualGenesisHash: string): void {
  if (expected.genesisHash !== actualGenesisHash) throw new Error(`ClusterMismatch: expected ${expected.name}`);
}
export function clusterLabel(genesisHash: string): string {
  const known: Record<string, string> = {
    "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "mainnet-beta",
    "EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "devnet",
  };
  return known[genesisHash] ?? `custom:${genesisHash.slice(0, 8)}`;
}
