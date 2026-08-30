export type DeploymentManifest = Readonly<{
  schema: 1;
  cluster: string;
  genesisHash: string | null;
  sourceCommit: string;
  status: "unverified" | "canary" | "verified";
  programs: Readonly<Record<string, Readonly<{ address: string; idlSha256: string | null; upgradeAuthority: string | null; verifiedBuild: boolean }>>>;
  mints: Readonly<{ projectDecimals: 9; settlementDecimals: 6; settlementMint: string | null; confidentialMint: string | null }>;
  external: Readonly<{ dammV2Program: string | null; dammV2Config: string | null }>;
  auditorEpochs: readonly Readonly<{ epoch: number; publicKey: string; startsAtSlot: string }>[];
}>;
export function validateDeployment(value: unknown): DeploymentManifest {
  if (!value || typeof value !== "object") throw new TypeError("deployment manifest object required");
  const manifest = value as Partial<DeploymentManifest>;
  if (manifest.schema !== 1 || typeof manifest.cluster !== "string" || typeof manifest.sourceCommit !== "string") throw new TypeError("deployment manifest schema");
  if (!manifest.programs || !manifest.mints || !manifest.external || !manifest.auditorEpochs) throw new TypeError("deployment manifest fields");
  return manifest as DeploymentManifest;
}
