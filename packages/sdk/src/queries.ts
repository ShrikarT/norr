export const LAUNCH_CREATOR_OFFSET = 8;
export const LAUNCH_BOARD_OFFSET = 40;
export const LAUNCH_FIXED_PREFIX_END = 274;
export type AccountFilter = Readonly<{ memcmp: Readonly<{ offset: number; bytes: string }> } | { dataSize: number }>;
export function launchByCreatorFilter(creator: string): readonly AccountFilter[] { return [{ memcmp: { offset: LAUNCH_CREATOR_OFFSET, bytes: creator } }]; }
export function launchByBoardFilter(board: string): readonly AccountFilter[] { return [{ memcmp: { offset: LAUNCH_BOARD_OFFSET, bytes: board } }]; }
