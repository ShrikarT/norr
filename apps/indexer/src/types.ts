export type IndexedEvent = Readonly<{ slot: bigint; signature: string; instructionIndex: number; innerIndex: number; program: string; kind: string; subject: string; payload: Readonly<Record<string, unknown>>; finalized: boolean }>;
export interface EventStore {
  insert(event: IndexedEvent): Promise<void>;
  finalizedCheckpoint(): Promise<bigint>;
  rewindAfter(slot: bigint): Promise<void>;
  activity(subject: string, limit: number): Promise<readonly IndexedEvent[]>;
  health(): Promise<Readonly<{ database: boolean; checkpoint: string }>>;
}
export interface IngestProvider {
  readonly name: string;
  stream(fromSlot: bigint, accept: (event: IndexedEvent) => Promise<void>): Promise<never>;
  backfill(fromSlot: bigint, toSlot: bigint, accept: (event: IndexedEvent) => Promise<void>): Promise<void>;
}
