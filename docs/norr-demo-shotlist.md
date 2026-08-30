# Norr — residency demo shotlist

Resolution 1920×1080 · 30 fps · H.264 + AAC. All product shots recorded from
the built app (`pnpm --filter @norr/web build && preview`) connected to
`https://api.devnet.solana.com`.

| # | Shot | Source | Duration | Notes |
|---|---|---|---|---|
| S1 | Title card: NORR wordmark draws in, tagline fades up | Motion graphic (HTML, design tokens) | 6 s | Solana violet on #08090a ground |
| S2a | Landing hero, slow push (scroll 0 → problem section) | Real screen, `/` | 6 s | Live Devnet readout visible in hero panel |
| S2b | Problem cards: front running / size signaling / unverifiable settlement | Real screen, `/#why` | 4 s | Hold on the three cards |
| S3 | Tagline reveal "If the chain cannot prove it, Norr will not show it." | Real screen, scroll into tagline | 8 s | Word-by-word activation on scroll |
| S4 | Conceptual confidential flow: amount → ElGamal ciphertext → proofs (equality/validity/range) → sale vault; settlement root emerges | Motion graphic (HTML) | 16 s | Persistent corner label "CONCEPTUAL — intended confidential flow" |
| S5a | Launches feed, filter tap Instant → Sealed | Real screen, `/launches` | 5 s | Devnet slot ticking in topbar |
| S5b | Launch detail: type 250 into trade box, quote recomputes; exact integer quote caption | Real screen, `/raise/northstar` | 6 s | Quote uses on-chain arithmetic |
| S5c | Sealed raise detail: fail-closed contribution panel + privacy boundary | Real screen, `/raise/quiet-harbour` | 5 s | Shows the gate in product context |
| S6a | Private workspace: metrics 5/5, evidence table with live "confirmed" rows | Real screen, `/private` | 8 s | RPC re-verification caption visible |
| S6b | Scroll to "Where execution stops": the real InvalidInstructionData log | Real screen, `/private` | 6 s | The actual devnet simulation output |
| S7 | Gate card: "One instruction away" — Token-2022 zk-ops disabled upstream, P0Required fail-closed, what unlocks it | Motion graphic (HTML) | 8 s | Honest, isolated blocker framing |
| S8 | Outro: NORR wordmark, tagline, github.com/ShrikarT/norr | Motion graphic (HTML) | 7 s | Music resolves |

Assembly: ffmpeg concat with 12-frame crossfades between scene families,
voiceover track at −1 dB, music bed at −22 dB with sidechain-style manual
ducking (music −16 dB under narration).

Deliverables:

- `norr-demo.mp4` (repo root)
- `norr-demo-thumbnail.png` (repo root)
- this file and `norr-demo-script.md` under `docs/`
