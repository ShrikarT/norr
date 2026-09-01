import { createSolanaRpc, fetchEncodedAccount, type Address, type Rpc } from "@solana/kit";
import { getStructDecoder, getU8Decoder, getU16Decoder, getI64Decoder, getU64Decoder, getU32Decoder, getAddressDecoder, getUtf8Decoder, getArrayDecoder, getTupleDecoder } from "@solana/kit";
import { encodeBase58 } from "./bytes";

export function createRpcClient(endpoint: string): Rpc<any> {
    return createSolanaRpc(endpoint);
}

export type OnchainLaunch = {
  address: string;
  creator: string;
  board: string;
  projectMint: string;
  contributionMint: string;
  sale: string;
  router: string;
  curve: string;
  model: "instant" | "raise";
  createdAt: number;
  flags: number;
  metadataHash: Uint8Array;
  name: string;
  symbol: string;
  uri: string;
  bump: number;
};

export type OnchainBoard = {
  address: string;
  owner: string;
  minBps: number;
  launchCount: number;
  createdAt: number;
  allowlistOnly: boolean;
  slug: string;
  name: string;
  uri: string;
  bump: number;
};

export type OnchainCurve = {
  address: string;
  launch: string;
  projectMint: string;
  baseMint: string;
  tokenVault: string;
  baseVault: string;
  router: string;
  liquidityBeneficiary: string;
  dammPosition: string;
  virtualBase: bigint;
  baseReserve: bigint;
  tokenReserve: bigint;
  graduationTarget: bigint;
  feeBps: number;
  active: boolean;
  graduated: boolean;
  maxBuyFirstSlots: bigint;
  liquidityUnlockAt: number;
  bump: number;
};

export function decodeLaunchAccount(address: string, data: Uint8Array): OnchainLaunch | null {
  try {
    if (data.length < 8 + 32 * 7 + 1 + 8 + 1 + 32 + 4 + 4 + 4 + 1) return null;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 8; // skip 8-byte discriminator
    const creator = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const board = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const projectMint = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const contributionMint = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const sale = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const router = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const curve = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const modelNum = view.getUint8(offset); offset += 1;
    const createdAt = Number(view.getBigInt64(offset, true)); offset += 8;
    const flags = view.getUint8(offset); offset += 1;
    const metadataHash = data.subarray(offset, offset + 32); offset += 32;

    const nameLen = view.getUint32(offset, true); offset += 4;
    const name = new TextDecoder().decode(data.subarray(offset, offset + nameLen)); offset += nameLen;

    const symLen = view.getUint32(offset, true); offset += 4;
    const symbol = new TextDecoder().decode(data.subarray(offset, offset + symLen)); offset += symLen;

    const uriLen = view.getUint32(offset, true); offset += 4;
    const uri = new TextDecoder().decode(data.subarray(offset, offset + uriLen)); offset += uriLen;

    const bump = view.getUint8(offset); offset += 1;

    return {
      address,
      creator,
      board,
      projectMint,
      contributionMint,
      sale,
      router,
      curve,
      model: modelNum === 0 ? "instant" : "raise",
      createdAt,
      flags,
      metadataHash,
      name,
      symbol,
      uri,
      bump,
    };
  } catch {
    return null;
  }
}

export function decodeBoardAccount(address: string, data: Uint8Array): OnchainBoard | null {
  try {
    if (data.length < 8 + 32 + 2 + 4 + 8 + 1 + 4 + 4 + 4 + 1) return null;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 8;
    const owner = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const minBps = view.getUint16(offset, true); offset += 2;
    const launchCount = view.getUint32(offset, true); offset += 4;
    const createdAt = Number(view.getBigInt64(offset, true)); offset += 8;
    const allowlistOnly = view.getUint8(offset) !== 0; offset += 1;

    const slugLen = view.getUint32(offset, true); offset += 4;
    const slug = new TextDecoder().decode(data.subarray(offset, offset + slugLen)); offset += slugLen;

    const nameLen = view.getUint32(offset, true); offset += 4;
    const name = new TextDecoder().decode(data.subarray(offset, offset + nameLen)); offset += nameLen;

    const uriLen = view.getUint32(offset, true); offset += 4;
    const uri = new TextDecoder().decode(data.subarray(offset, offset + uriLen)); offset += uriLen;

    const bump = view.getUint8(offset); offset += 1;

    return {
      address,
      owner,
      minBps,
      launchCount,
      createdAt,
      allowlistOnly,
      slug,
      name,
      uri,
      bump,
    };
  } catch {
    return null;
  }
}

export function decodeCurveAccount(address: string, data: Uint8Array): OnchainCurve | null {
  try {
    if (data.length < 8 + 32 * 8 + 8 * 4 + 2 + 1 + 1 + 8 + 8 + 1) return null;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 8;
    const launch = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const projectMint = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const baseMint = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const tokenVault = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const baseVault = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const router = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const liquidityBeneficiary = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;
    const dammPosition = encodeBase58(data.subarray(offset, offset + 32)); offset += 32;

    const virtualBase = view.getBigUint64(offset, true); offset += 8;
    const baseReserve = view.getBigUint64(offset, true); offset += 8;
    const tokenReserve = view.getBigUint64(offset, true); offset += 8;
    const graduationTarget = view.getBigUint64(offset, true); offset += 8;
    const feeBps = view.getUint16(offset, true); offset += 2;
    const active = view.getUint8(offset) !== 0; offset += 1;
    const graduated = view.getUint8(offset) !== 0; offset += 1;
    const maxBuyFirstSlots = view.getBigUint64(offset, true); offset += 8;
    const liquidityUnlockAt = Number(view.getBigInt64(offset, true)); offset += 8;
    const bump = view.getUint8(offset); offset += 1;

    return {
      address,
      launch,
      projectMint,
      baseMint,
      tokenVault,
      baseVault,
      router,
      liquidityBeneficiary,
      dammPosition,
      virtualBase,
      baseReserve,
      tokenReserve,
      graduationTarget,
      feeBps,
      active,
      graduated,
      maxBuyFirstSlots,
      liquidityUnlockAt,
      bump,
    };
  } catch {
    return null;
  }
}

export const launchDecoder = getStructDecoder([
    ["discriminator", getArrayDecoder(getU8Decoder(), { size: 8 })],
    ["creator", getAddressDecoder()],
    ["board", getAddressDecoder()],
    ["project_mint", getAddressDecoder()],
    ["contribution_mint", getAddressDecoder()],
    ["sale", getAddressDecoder()],
    ["router", getAddressDecoder()],
    ["curve", getAddressDecoder()],
    ["model", getU8Decoder()],
    ["created_at", getI64Decoder()],
    ["flags", getU8Decoder()],
    ["metadata_hash", getArrayDecoder(getU8Decoder(), { size: 32 })],
    ["name", getUtf8Decoder()],
    ["symbol", getUtf8Decoder()],
    ["uri", getUtf8Decoder()],
    ["bump", getU8Decoder()],
]);

export const boardDecoder = getStructDecoder([
    ["discriminator", getArrayDecoder(getU8Decoder(), { size: 8 })],
    ["owner", getAddressDecoder()],
    ["min_bps", getU16Decoder()],
    ["launch_count", getU32Decoder()],
    ["created_at", getI64Decoder()],
    ["allowlist_only", getU8Decoder()],
    ["slug", getUtf8Decoder()],
    ["name", getUtf8Decoder()],
    ["uri", getUtf8Decoder()],
    ["bump", getU8Decoder()],
]);

export async function fetchLaunch(rpc: Rpc<any>, address: Address) {
    const account = await fetchEncodedAccount(rpc, address);
    if (!account.exists) return null;
    return launchDecoder.decode(account.data);
}

export async function fetchBoard(rpc: Rpc<any>, address: Address) {
    const account = await fetchEncodedAccount(rpc, address);
    if (!account.exists) return null;
    return boardDecoder.decode(account.data);
}

