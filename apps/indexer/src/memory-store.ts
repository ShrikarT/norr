import type { EventStore, IndexedEvent } from "./types.js";
export class MemoryStore implements EventStore {
  private events = new Map<string, IndexedEvent>();
  async insert(event: IndexedEvent): Promise<void> { this.events.set(`${event.slot}:${event.signature}:${event.instructionIndex}:${event.innerIndex}`, event); }
  async finalizedCheckpoint(): Promise<bigint> { return [...this.events.values()].filter((event) => event.finalized).reduce((max, event) => event.slot > max ? event.slot : max, 0n); }
  async rewindAfter(slot: bigint): Promise<void> { for (const [key, event] of this.events) if (event.slot > slot && !event.finalized) this.events.delete(key); }
  async activity(subject: string, limit: number): Promise<readonly IndexedEvent[]> { return [...this.events.values()].filter((event) => event.subject === subject).sort((a, b) => a.slot > b.slot ? -1 : 1).slice(0, limit); }
  async health() { return { database: true, checkpoint: (await this.finalizedCheckpoint()).toString() }; }
}
