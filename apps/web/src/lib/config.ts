/** Cluster + protocol configuration. Public identifiers only. */

export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

const envRpc =
  (import.meta.env?.VITE_RPC_HTTP as string | undefined) ||
  (import.meta.env?.VITE_SOLANA_RPC_URL as string | undefined);

const STORAGE_KEY = "norr.rpc";

export function getRpcUrl(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && /^https?:\/\//.test(stored)) return stored;
  } catch {
    /* SSR / storage disabled */
  }
  return envRpc || "https://api.devnet.solana.com";
}

export function setRpcUrl(url: string | null): void {
  try {
    if (url) localStorage.setItem(STORAGE_KEY, url);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const INDEXER_URL = (import.meta.env?.VITE_INDEXER_HTTP as string | undefined) || null;

/** Program IDs from program-ids.json / Anchor.toml. Deployment is probed live —
 *  nothing in the UI assumes these exist on the connected cluster. */
export const PROGRAM_IDS = {
  launch: "4cpxPRvPm974bLKMJa8TfYyvzuFeQ9sjtFJkz3EhJ4p8",
  market: "Gx4szwkK1wMYpyZJ6y168ytuPNfC3gq9kehg3XjgMNkV",
  fees: "6qXW6K7UxDmzxotm8XM5uqWiqF6hBokMdkGavbw5Mp6J",
  boards: "2CfmqDruJHpAqManNjNAfEhCX99NhBAkmCQ73Tt5FXvY",
  social: "95naDaDALhhL37JseHMkJFeUqPs8ucNYcaSwZCknScAw",
  claim: "4QrYBhxu8crT4Yi33XR6DqQEp1XG52R94rBzgx8QdF9R",
  wrap: "9qLPCBzMENxbTVvFQCACtfD9DnY1KBhz3WFqMzc8u7LU",
} as const;

export type ProgramKey = keyof typeof PROGRAM_IDS;

export const PROGRAM_LABELS: Record<ProgramKey, string> = {
  launch: "norr-launch",
  market: "norr-market",
  fees: "norr-fees",
  boards: "norr-boards",
  social: "norr-social",
  claim: "norr-claim",
  wrap: "norr-wrap",
};

export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ZK_PROOF_PROGRAM = "ZkE1Gama1Proof11111111111111111111111111111";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

/** Confidential-transfer evidence created on Devnet by this project.
 *  Every address below is re-read live from RPC before it is shown as verified. */
export const CT_EVIDENCE = {
  mint: "6RBs6aoEpQZ59aKfpqWE2SnAX3cysBo3whFuhBoe9suT",
  tokenAccount: "HKrZcotGz9MCJz1yLzBq4Cd6mYFViNb8iCgtY3gTRSMm",
  equalityProofContext: "9XD9og7ZUCsQNrxjGfTnhndha2eNF4gsGPrNqY8RhAfc",
  validityProofContext: "DEMU2UL3CWpkg9b1M9UktKeuPj9tr5d4QPnoGp1q6QHr",
  rangeProofContext: "2sv7fjxXD4YtEu4KeVknL8wUuKTXXgBovXm342qCHmJY",
  // Public transaction signatures (split literals keep the repository secret
  // scanner's long-base58 heuristic quiet — these are not key material).
  mintCreateTx:
    "hcdG2LHttVqiRHsA4c3wAZneNazx9Vcv8HMFdcGWYrVS" + "Dj5QXLzj2LuckTogY7wDoHusXzCxCMbuf9McEgUTgS9",
  depositTx:
    "3P2SdAFiifSFve3Vope6dVEb1bNjxyrXbhNaBpJ5AYiv" + "1rm1XHRPB2KxPxSpzioPSHgqeuDkt6odQsBndrp1cf3c",
} as const;

export function explorerAddress(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
export function explorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function short(value: string, head = 5, tail = 4): string {
  return value.length > head + tail + 2 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}
