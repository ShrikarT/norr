CREATE TABLE IF NOT EXISTS indexed_events (
  slot BIGINT NOT NULL,
  signature TEXT NOT NULL,
  instruction_index INTEGER NOT NULL,
  inner_index INTEGER NOT NULL,
  program_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload JSONB NOT NULL,
  finalized BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (slot, signature, instruction_index, inner_index)
);
CREATE INDEX IF NOT EXISTS indexed_events_subject_slot ON indexed_events(subject, slot DESC);
CREATE TABLE IF NOT EXISTS checkpoints (provider TEXT PRIMARY KEY, finalized_slot BIGINT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
