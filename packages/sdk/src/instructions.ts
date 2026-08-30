import { concatBytes, u32le, u64le, u16le, utf8, addressBytes } from "./bytes.js";

export type AccountMeta = Readonly<{
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}>;

export type Instruction = Readonly<{
  programId: string;
  accounts: readonly AccountMeta[];
  data: Uint8Array;
}>;

/**
 * Anchor 8-byte instruction discriminators (sha256("global:<name>")[0..8])
 */
export const DISCRIMINATORS = {
  market: {
    initialize: new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]),
    buy: new Uint8Array([102, 6, 61, 18, 1, 218, 235, 234]),
    sell: new Uint8Array([51, 230, 133, 164, 1, 127, 131, 173]),
    activate: new Uint8Array([194, 203, 35, 100, 151, 55, 170, 82]),
    graduate: new Uint8Array([156, 128, 161, 237, 123, 154, 222, 38]),
  },
  fees: {
    initialize: new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]),
    accrue: new Uint8Array([118, 10, 114, 188, 151, 74, 174, 183]),
    release: new Uint8Array([121, 62, 132, 196, 215, 11, 240, 157]),
    releaseAll: new Uint8Array([182, 184, 197, 7, 72, 184, 98, 93]),
  },
  launch: {
    create: new Uint8Array([230, 245, 175, 104, 223, 199, 90, 84]),
    configure: new Uint8Array([73, 55, 170, 158, 24, 76, 240, 103]),
  },
  boards: {
    create: new Uint8Array([57, 193, 232, 18, 185, 224, 82, 102]),
    update: new Uint8Array([219, 200, 46, 69, 130, 160, 0, 128]),
  },
  social: {
    initThread: new Uint8Array([148, 110, 191, 149, 192, 139, 44, 192]),
    post: new Uint8Array([143, 85, 95, 222, 163, 102, 140, 183]),
    hide: new Uint8Array([203, 170, 220, 93, 113, 190, 48, 198]),
    createProfile: new Uint8Array([225, 230, 175, 59, 175, 239, 195, 158]),
    follow: new Uint8Array([170, 4, 170, 157, 247, 85, 213, 114]),
    unfollow: new Uint8Array([115, 60, 49, 230, 140, 157, 116, 230]),
    save: new Uint8Array([173, 220, 14, 24, 95, 15, 167, 169]),
    unsave: new Uint8Array([234, 131, 157, 126, 175, 150, 144, 224]),
    promote: new Uint8Array([122, 175, 188, 77, 98, 147, 18, 117]),
  },
  claim: {
    initialize: new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]),
    claim: new Uint8Array([62, 198, 214, 193, 213, 159, 108, 210]),
    refund: new Uint8Array([2, 96, 183, 251, 63, 206, 107, 110]),
  }
} as const;

/**
 * Builds instructions for norr-market bonding curve trades.
 */
export function buildMarketBuyInstruction(
  programId: string,
  accounts: {
    user: string;
    curve: string;
    userBaseToken: string;
    userProjectToken: string;
    baseVault: string;
    tokenVault: string;
    routerVault: string;
    router: string;
    tokenProgram: string;
  },
  minTokensOut: bigint,
  maxBaseIn: bigint
): Instruction {
  const data = concatBytes(
    DISCRIMINATORS.market.buy,
    u64le(minTokensOut),
    u64le(maxBaseIn)
  );

  return {
    programId,
    accounts: [
      { pubkey: accounts.user, isSigner: true, isWritable: true },
      { pubkey: accounts.curve, isSigner: false, isWritable: true },
      { pubkey: accounts.userBaseToken, isSigner: false, isWritable: true },
      { pubkey: accounts.userProjectToken, isSigner: false, isWritable: true },
      { pubkey: accounts.baseVault, isSigner: false, isWritable: true },
      { pubkey: accounts.tokenVault, isSigner: false, isWritable: true },
      { pubkey: accounts.routerVault, isSigner: false, isWritable: true },
      { pubkey: accounts.router, isSigner: false, isWritable: false },
      { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
    ],
    data,
  };
}

export function buildMarketSellInstruction(
  programId: string,
  accounts: {
    user: string;
    curve: string;
    userBaseToken: string;
    userProjectToken: string;
    baseVault: string;
    tokenVault: string;
    routerVault: string;
    router: string;
    tokenProgram: string;
  },
  tokensIn: bigint,
  minBaseOut: bigint
): Instruction {
  const data = concatBytes(
    DISCRIMINATORS.market.sell,
    u64le(tokensIn),
    u64le(minBaseOut)
  );

  return {
    programId,
    accounts: [
      { pubkey: accounts.user, isSigner: true, isWritable: true },
      { pubkey: accounts.curve, isSigner: false, isWritable: true },
      { pubkey: accounts.userBaseToken, isSigner: false, isWritable: true },
      { pubkey: accounts.userProjectToken, isSigner: false, isWritable: true },
      { pubkey: accounts.baseVault, isSigner: false, isWritable: true },
      { pubkey: accounts.tokenVault, isSigner: false, isWritable: true },
      { pubkey: accounts.routerVault, isSigner: false, isWritable: true },
      { pubkey: accounts.router, isSigner: false, isWritable: false },
      { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
    ],
    data,
  };
}

/**
 * Builds instructions for norr-fees release.
 */
export function buildFeesReleaseInstruction(
  programId: string,
  accounts: {
    recipientSigner: string;
    router: string;
    routerVault: string;
    recipientVault: string;
    tokenProgram: string;
  },
  recipientPubkey: string
): Instruction {
  const data = concatBytes(
    DISCRIMINATORS.fees.release,
    addressBytes(recipientPubkey)
  );

  return {
    programId,
    accounts: [
      { pubkey: accounts.recipientSigner, isSigner: true, isWritable: true },
      { pubkey: accounts.router, isSigner: false, isWritable: true },
      { pubkey: accounts.routerVault, isSigner: false, isWritable: true },
      { pubkey: accounts.recipientVault, isSigner: false, isWritable: true },
      { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
    ],
    data,
  };
}

/**
 * Builds instructions for norr-launch creation.
 */
export function buildLaunchCreateInstruction(
  programId: string,
  accounts: {
    creator: string;
    launch: string;
    systemProgram: string;
  },
  args: {
    name: string;
    symbol: string;
    uri: string;
    projectMint: string;
    contributionMint: string;
    sale: string;
    router: string;
    curve: string;
    model: number;
    metadataHash: Uint8Array;
  }
): Instruction {
  const nameBytes = utf8(args.name);
  const symbolBytes = utf8(args.symbol);
  const uriBytes = utf8(args.uri);

  const data = concatBytes(
    DISCRIMINATORS.launch.create,
    addressBytes(args.projectMint),
    addressBytes(args.contributionMint),
    addressBytes(args.sale),
    addressBytes(args.router),
    addressBytes(args.curve),
    new Uint8Array([args.model]),
    args.metadataHash,
    u32le(nameBytes.length),
    nameBytes,
    u32le(symbolBytes.length),
    symbolBytes,
    u32le(uriBytes.length),
    uriBytes
  );

  return {
    programId,
    accounts: [
      { pubkey: accounts.creator, isSigner: true, isWritable: true },
      { pubkey: accounts.launch, isSigner: false, isWritable: true },
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    ],
    data,
  };
}

/**
 * Builds instructions for norr-boards creation.
 */
export function buildBoardCreateInstruction(
  programId: string,
  accounts: {
    owner: string;
    board: string;
    systemProgram: string;
  },
  args: {
    slug: string;
    name: string;
    uri: string;
    minBps: number;
    allowlistOnly: boolean;
  }
): Instruction {
  const slugBytes = utf8(args.slug);
  const nameBytes = utf8(args.name);
  const uriBytes = utf8(args.uri);

  const data = concatBytes(
    DISCRIMINATORS.boards.create,
    u32le(slugBytes.length),
    slugBytes,
    u32le(nameBytes.length),
    nameBytes,
    u32le(uriBytes.length),
    uriBytes,
    u16le(args.minBps),
    new Uint8Array([args.allowlistOnly ? 1 : 0])
  );

  return {
    programId,
    accounts: [
      { pubkey: accounts.owner, isSigner: true, isWritable: true },
      { pubkey: accounts.board, isSigner: false, isWritable: true },
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    ],
    data,
  };
}

/**
 * Builds instructions for norr-social actions.
 */
export function buildSocialPostInstruction(
  programId: string,
  accounts: {
    author: string;
    thread: string;
    comment: string;
    profile: string;
    systemProgram: string;
  },
  body: string,
  parentIndex: number
): Instruction {
  const bodyBytes = utf8(body);
  const data = concatBytes(
    DISCRIMINATORS.social.post,
    u32le(bodyBytes.length),
    bodyBytes,
    u32le(parentIndex)
  );

  return {
    programId,
    accounts: [
      { pubkey: accounts.author, isSigner: true, isWritable: true },
      { pubkey: accounts.thread, isSigner: false, isWritable: true },
      { pubkey: accounts.comment, isSigner: false, isWritable: true },
      { pubkey: accounts.profile, isSigner: false, isWritable: true },
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    ],
    data,
  };
}

export function buildSocialFollowInstruction(
  programId: string,
  accounts: {
    follower: string;
    target: string;
    follow: string;
    followerProfile: string;
    targetProfile: string;
    systemProgram: string;
  }
): Instruction {
  return {
    programId,
    accounts: [
      { pubkey: accounts.follower, isSigner: true, isWritable: true },
      { pubkey: accounts.target, isSigner: false, isWritable: false },
      { pubkey: accounts.follow, isSigner: false, isWritable: true },
      { pubkey: accounts.followerProfile, isSigner: false, isWritable: true },
      { pubkey: accounts.targetProfile, isSigner: false, isWritable: true },
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    ],
    data: DISCRIMINATORS.social.follow,
  };
}
