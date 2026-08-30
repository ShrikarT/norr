# Implementation status

This matrix is deliberately stricter than a checklist that marks source files “ported.” A
row is complete only when the code can be verified in the current environment.

| Area | Source present | Executed here | Production gate |
|---|---:|---:|---|
| Exact curve/split/Merkle TypeScript math | yes | yes | Rust parity vectors still require Anchor build |
| Deterministic tally manifest | yes | yes | two independent offline operators |
| Launch / boards / fee / social program source | yes | no Rust toolchain | localnet + audit |
| Claim public state / Merkle path | yes | no Rust toolchain | P0 adapter + funded success/refund drills |
| Token-2022 confidential adapter | fail-closed boundary only | gate test | full P0 on target cluster |
| Meteora DAMM v2 CPI | fail-closed boundary only | not available | cloned-account P3 fixture |
| React routes and component surfaces | yes | local offline bundle | RPC/wallet acceptance matrix |
| Indexer API/schema | yes | local degraded mode | LaserStream + Triton + PostgreSQL rebuild |
| Verified deployment/authority posture | manifests unverified | no | all §13.4 items |
| Distribution license | pending | n/a | author/counsel approval |

No row above should be interpreted as a deployed protocol.
