# Parity tracker

Behavioral source: `nickthelegend/norr-fun@5af8fcd`.

- Contracts map to the seven domains listed in `PLAN.md` §16.1.
- All 19 route entries are represented in `apps/web/src/App.tsx`.
- All 41 named component surfaces plus `components/ui/` exist under `apps/web/src/components`.
- Generated EVM verifiers, browser bytecode, proving keys, hardcoded decryptor, pair factory,
  and custom encrypted ledger are intentionally absent for the reasons in §16.4.
- Source deployment artifacts are represented by unverified per-cluster manifests and may
  not be rendered as deployed until account existence and ownership are verified.

The 110 browser cases remain an acceptance gate. No historical PASS label is inherited.
