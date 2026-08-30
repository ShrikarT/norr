# Build report

## Verified in the delivery sandbox

- Pure TypeScript protocol suite: 11/11 passing.
- Keccak-256 canonical vectors match.
- 2,000 randomized curve checks preserve or increase the reserve product under ceiling division.
- Per-delta fee accrual stays monotonic and allocates every atomic unit.
- Claim and refund Merkle domains cannot cross.
- Tally output is canonical and deterministic.
- Private operations fail closed without a complete cluster-matched P0 report.
- Offline React bundle builds successfully.
- Feed, instant market, sealed raise, private workspace, create flow, and desks were rendered at desktop/mobile sizes with no console errors, clipped overflow, overlay collisions, or horizontal scroll.
- Indexer health endpoint and CLI help are exercised by the verification command.

## Not verifiable in this sandbox

Rust, Solana/Agave, Anchor, Token-2022 proof programs, target-cluster wallet hardware, PostgreSQL, Helius/Triton credentials, and Meteora DAMM v2 cloned accounts are unavailable. No Anchor compile, validator test, P0 report, DAMM CPI test, deployment, verified build, audit, or authority handover is claimed. The corresponding value paths fail closed.
