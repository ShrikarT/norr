/** Diagnostic-only JSON. Converts bigint at print time. Does not mutate protocol values. */
export function safeJson(value: unknown, space?: number): string {
  return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? `${v}n` : v), space);
}
