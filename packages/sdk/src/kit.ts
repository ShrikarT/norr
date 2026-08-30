import { address, getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";
import type { PdaDeriver } from "./pda.js";

const encoder = getAddressEncoder();
export const kitPdaDeriver: PdaDeriver = async (programAddress, seeds) => {
  const [derived, bump] = await getProgramDerivedAddress({ programAddress: address(programAddress), seeds: seeds as any });
  return { address: derived, bump: Number(bump) };
};
export function encodeAddress(value: string): Uint8Array { return new Uint8Array(encoder.encode(address(value))); }
