// @ts-ignore
import pkg from 'pg';
const { Pool } = pkg;
import { type IndexedEvent } from "./types.js";

export class PgStore {
  private pool: typeof Pool;

  constructor(connectionString?: string) {
    this.pool = new (Pool as any)({ connectionString: connectionString || process.env.DATABASE_URL });
  }

  async health() {
    try {
      const res = await (this.pool as any).query("SELECT 1 AS ok");
      return { database: res.rows[0]?.ok === 1 };
    } catch (e) {
      return { database: false, error: String(e) };
    }
  }

  async activity(subject: string, limit: number): Promise<IndexedEvent[]> {
    const res = await (this.pool as any).query(
      "SELECT * FROM indexed_events WHERE subject = $1 ORDER BY slot DESC LIMIT $2",
      [subject, limit]
    );
    return res.rows.map((row: any) => ({
      slot: BigInt(row.slot),
      signature: row.signature,
      instructionIndex: row.instruction_index,
      innerIndex: row.inner_index,
      program: row.program_id,
      kind: row.kind,
      subject: row.subject,
      payload: row.payload,
      finalized: row.finalized
    }));
  }

  async applyMigration(sql: string) {
    await (this.pool as any).query(sql);
  }
}
