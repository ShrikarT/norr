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
    graduate: new Uint8Array([45, 235, 225, 181, 17, 218, 64, 130]),
  },
  fees: {
    initialize: new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]),
    lock: new Uint8Array([21, 19, 208, 43, 237, 62, 255, 87]),
    release: new Uint8Array([253, 249, 15, 206, 28, 127, 193, 241]),
    sync: new Uint8Array([4, 219, 40, 164, 21, 157, 189, 88]),
  },
  launch: {
    create: new Uint8Array([24, 30, 200, 40, 5, 28, 7, 119]),
    setUri: new Uint8Array([72, 22, 136, 186, 78, 5, 136, 229]),
    attachBoard: new Uint8Array([91, 244, 148, 124, 251, 39, 36, 174]),
    activate: new Uint8Array([194, 203, 35, 100, 151, 55, 170, 82]),
  },
  boards: {
    create: new Uint8Array([24, 30, 200, 40, 5, 28, 7, 119]),
    setTerms: new Uint8Array([198, 18, 197, 226, 220, 230, 87, 173]),
    update: new Uint8Array([219, 200, 88, 176, 158, 63, 253, 127]),
  },
  social: {
    initializeThread: new Uint8Array([207, 78, 91, 185, 87, 244, 142, 11]),
    post: new Uint8Array([223, 96, 234, 236, 158, 106, 145, 94]),
    hide: new Uint8Array([174, 155, 104, 251, 192, 201, 92, 117]),
    createProfile: new Uint8Array([225, 230, 175, 59, 175, 239, 195, 158]),
    follow: new Uint8Array([170, 4, 170, 157, 247, 85, 213, 114]),
    unfollow: new Uint8Array([115, 60, 49, 230, 140, 157, 116, 230]),
    save: new Uint8Array([173, 220, 14, 24, 95, 15, 167, 169]),
    unsave: new Uint8Array([234, 131, 157, 126, 175, 150, 144, 224]),
    promote: new Uint8Array([122, 175, 188, 77, 98, 147, 18, 117]),
  },
  claim: {
    initialize: new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]),
    contribute: new Uint8Array([82, 33, 68, 131, 32, 0, 205, 95]),
    openClaim: new Uint8Array([222, 101, 161, 226, 92, 247, 44, 252]),
    settle: new Uint8Array([175, 42, 185, 87, 144, 131, 102, 212]),
    settleRefund: new Uint8Array([184, 199, 80, 86, 67, 46, 2, 113]),
    activate: new Uint8Array([194, 203, 35, 100, 151, 55, 170, 82]),
  },
  wrap: {
    initialize: new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]),
    wrap: new Uint8Array([178, 40, 10, 189, 228, 129, 186, 140]),
    unwrap: new Uint8Array([126, 175, 198, 14, 212, 69, 50, 44]),
    rotateAuditor: new Uint8Array([82, 153, 203, 218, 123, 145, 232, 93]),
    setPaused: new Uint8Array([91, 60, 125, 192, 176, 225, 166, 218]),
    recoverExcess: new Uint8Array([137, 118, 196, 86, 140, 124, 81, 222]),
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
