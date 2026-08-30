# Confidential transfer boundary

The privacy statement is **amount confidentiality**, not anonymity. Participants, timing,
account relationships, public wrapper deposits, and aggregate backing remain visible.

The application has no custom private balance fallback. A private action is enabled only
after `@norr/confidential` validates a `norr-p0-v1` report for the connected cluster. The
report must include wallet capability tests, proof-context binding, pending-credit races,
Sale-PDA custody, direct-credit rejection, atomic gate rollback, wrapper solvency, key
epochs, deterministic recovery, a funded success settlement, and a funded disaster refund.

Secrets are derived from the official signer-bound routine, used in memory, and never sent
to the browser logger, indexer, analytics, localStorage, CI, or deployment manifest.
