import { createSolanaRpc, fetchEncodedAccount, type Address, type Rpc } from "@solana/kit";
import { getStructDecoder, getU8Decoder, getI64Decoder, getU64Decoder, getU32Decoder, getAddressDecoder, getUtf8Decoder, getArrayDecoder, getTupleDecoder } from "@solana/kit";

export function createRpcClient(endpoint: string): Rpc<any> {
    return createSolanaRpc(endpoint);
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
    ["min_bps", getU64Decoder()],
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
