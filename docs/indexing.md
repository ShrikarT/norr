# Rebuildable indexing

RPC program accounts are authoritative for current state and every money-moving decision.
The indexer stores only history, search, candles, notifications, and profile activity. Its
idempotency key is `(slot, signature, instruction_index, inner_index)`. Finalized checkpoints
survive restart; unfinalized rows are rewound after forks. A clean PostgreSQL database must
rebuild from the independent RPC and converge with production fixtures. If the indexer is
unavailable, the web app states that history is unavailable and keeps account reads and
transactions functional.
