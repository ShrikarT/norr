import {
  type Address,
  address,
  createRpc,
  createDefaultRpcTransport,
  createSolanaRpcApi
} from "@solana/kit";
import type { GetGenesisHashApi, GetVersionApi, GetAccountInfoApi } from "@solana/kit";

import { TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022"; export const TOKEN_2022_PROGRAM_ID = TOKEN_2022_PROGRAM_ADDRESS;
import { ZK_ELGAMAL_PROOF_PROGRAM_ADDRESS } from "@solana-program/zk-elgamal-proof"; export const ZK_PROOF_PROGRAM_ID = ZK_ELGAMAL_PROOF_PROGRAM_ADDRESS;

export type ClusterValidationResult = Readonly<{
  genesisHash: string;
  version: string;
  token2022Deployed: boolean;
  zkProofDeployed: boolean;
}>;

/**
 * Validates the cluster capabilities required for Phase 3 P0.
 * Makes real RPC queries to fetch genesis hash, version, and program info.
 */
export async function validateCluster(rpcUrl: string): Promise<ClusterValidationResult> {
  const rpc = createRpc<GetGenesisHashApi & GetVersionApi & GetAccountInfoApi, any>({
    api: createSolanaRpcApi(),
    transport: createDefaultRpcTransport({ url: rpcUrl }),
  });

  const [genesisHashRes, versionRes, token2022Info, zkProofInfo] = await Promise.all([
    rpc.getGenesisHash().send(),
    rpc.getVersion().send(),
    rpc.getAccountInfo(TOKEN_2022_PROGRAM_ID, { encoding: "base64" }).send(),
    rpc.getAccountInfo(ZK_PROOF_PROGRAM_ID, { encoding: "base64" }).send(),
  ]);

  return {
    genesisHash: genesisHashRes,
    version: versionRes["solana-core"] || (versionRes as any)["agave-core"] || "unknown",
    token2022Deployed: token2022Info.value !== null && token2022Info.value.executable,
    zkProofDeployed: zkProofInfo.value !== null && zkProofInfo.value.executable,
  };
}
