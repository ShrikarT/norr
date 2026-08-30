# Norr — residency demo script

Target length: 90–100 seconds. Product-first: real screens, real Devnet
evidence, one clearly labeled conceptual animation. No fabricated
confidential transfers anywhere.

---

## Narration (voiceover, ~95 seconds)

> On-chain token raises leak everything. Contribution sizes are public the
> moment they land — so bots copy large wallets, snipe allocations, and front
> run the market before price discovery even begins.
>
> Norr is a token launch protocol on Solana built around one idea: private
> contribution, public settlement.
>
> While a raise is open, contribution amounts are encrypted with Token-2022
> confidential transfers — Twisted ElGamal ciphertexts, with zero-knowledge
> equality, validity, and range proofs verified by Solana's native proof
> program. Participants and timing stay public. The amount does not.
>
> When the raise closes, every allocation commits to a Merkle root on chain,
> and settled tokens trade on an autonomous bonding curve with exact integer
> pricing and basis-point fee routing — across seven Anchor programs.
>
> This is not a concept deck. The confidential setup pipeline is confirmed on
> Solana Devnet: a live confidential mint, a configured encrypted account,
> three verified zero-knowledge proof contexts, and an encrypted deposit —
> every address re-verified against RPC each time the app loads.
>
> One step remains gated: the canonical Token-2022 program on public clusters
> ships without zk-ops, so the confidential transfer instruction itself is
> disabled upstream. Norr refuses to fake it — private paths stay fail-closed
> until the chain can prove the capability. No fallback ledger. No invented
> numbers.
>
> Norr. Private contribution. Public settlement. Built on Solana.

Word count ≈ 232 → ~95 s at a measured pace.

---

## Timing map

| Time | Scene | Audio |
|---|---|---|
| 0:00–0:06 | S1 Title card (motion graphic) | Music in |
| 0:06–0:16 | S2 Problem (landing hero + problem cards, real screen) | "On-chain token raises leak everything…" |
| 0:16–0:24 | S3 Positioning (landing tagline + hero readout) | "Norr is a token launch protocol…" |
| 0:24–0:40 | S4 Conceptual privacy animation (labeled CONCEPTUAL) | "While a raise is open… the amount does not." |
| 0:40–0:54 | S5 Product: launches feed → launch detail → live trade quote | "When the raise closes… seven Anchor programs." |
| 0:54–1:10 | S6 Real Devnet evidence (/private live table + explorer addresses) | "This is not a concept deck…" |
| 1:10–1:24 | S7 The honest gate (fail-closed card, real error log) | "One step remains gated…" |
| 1:24–1:33 | S8 Outro card (NORR + repo) | "Norr. Private contribution. Public settlement." |

---

## Hard rules observed

- Scenes S2, S3, S5, S6, S7 are captures of the actual running product
  against live Solana Devnet RPC.
- S4 is the only synthetic scene and carries a persistent on-screen label:
  "CONCEPTUAL — intended confidential flow". It shows the design intent of
  the gated transfer; it never claims execution.
- No successful confidential transfer is depicted or implied as executed.
- All addresses shown are the real Devnet artifacts from `program-ids.json`
  and the CT evidence set.
