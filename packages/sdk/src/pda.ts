import { u32le, utf8 } from "./bytes.js";

export type DerivedAddress = Readonly<{ address: string; bump: number }>;
export type PdaDeriver = (programAddress: string, seeds: readonly Uint8Array[]) => Promise<DerivedAddress>;
export type ProgramAddresses = Readonly<{
  launch: string; claim: string; fees: string; market: string; boards: string; social: string; wrap: string;
}>;

export function createPdaRegistry(programs: ProgramAddresses, derive: PdaDeriver) {
  return {
    launch: (projectMint: Uint8Array) => derive(programs.launch, [utf8("launch"), projectMint]),
    sale: (launch: Uint8Array) => derive(programs.claim, [utf8("sale"), launch]),
    claim: (sale: Uint8Array, claimant: Uint8Array) => derive(programs.claim, [utf8("claim"), sale, claimant]),
    router: (launch: Uint8Array) => derive(programs.fees, [utf8("router"), launch]),
    curve: (projectMint: Uint8Array) => derive(programs.market, [utf8("curve"), projectMint]),
    curveTokenVault: (curve: Uint8Array) => derive(programs.market, [utf8("ctok"), curve]),
    curveBaseVault: (curve: Uint8Array) => derive(programs.market, [utf8("cbase"), curve]),
    board: (slug: string) => {
      const seed = utf8(slug);
      if (seed.length === 0 || seed.length > 32) throw new RangeError("slug must be 1..32 UTF-8 bytes");
      return derive(programs.boards, [utf8("board"), seed]);
    },
    thread: (subject: Uint8Array) => derive(programs.social, [utf8("thread"), subject]),
    comment: (subject: Uint8Array, index: number) => derive(programs.social, [utf8("comment"), subject, u32le(index)]),
    follow: (follower: Uint8Array, target: Uint8Array) => derive(programs.social, [utf8("follow"), follower, target]),
    saved: (account: Uint8Array, subject: Uint8Array) => derive(programs.social, [utf8("saved"), account, subject]),
    profile: (wallet: Uint8Array) => derive(programs.social, [utf8("profile"), wallet]),
    subjectStats: (subject: Uint8Array) => derive(programs.social, [utf8("subject"), subject]),
    promo: (subject: Uint8Array) => derive(programs.social, [utf8("promo"), subject]),
    promoConfig: () => derive(programs.social, [utf8("promo_config")]),
    wrapMint: (underlyingMint: Uint8Array) => derive(programs.wrap, [utf8("cmint"), underlyingMint]),
    wrapVault: (underlyingMint: Uint8Array) => derive(programs.wrap, [utf8("cvault"), underlyingMint]),
  } as const;
}
