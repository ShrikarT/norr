# Design — norr.fun on Solana

<!-- impeccable:design-schema 1 -->

The system norr.fun commits to. Change it here first; anything that drifts from this is a
bug, not a variation.

The complete visual and interaction design specification for Norr on Solana. Ground, ink ramp, hairlines, square geometry, type scale, primitives, motion policy, and anti-patterns.

---

## The direction — tactical telemetry

Unchanged. CRT terminal / aerospace HUD. Dark-exclusive, monospace-dominant, one signal
hue on a near-black field, technical framing devices, high data density.

**Ground is `#08090a`, not `#000000`.** Pure black kills the hairlines every table here is
built from and removes any sense of a lit panel above a field. It reads as black; it still
has structure.

---

## The accent system

The Norr accent is Solana violet (`#ab7aff` for high-contrast readable text, `#9945ff` for badges and marks). Red (`#e84142`) is strictly reserved for `--loss` and negative market movements.

On this surface, **red means exactly one thing: a position or price that went down.**

### What was rejected, and why

**Solana green `#14F195` — rejected.** It measures 13.3:1 on the ground, so this is not a
contrast problem; it is a semantic one. `--gain` is `#3fcf8a`. Putting the brand accent in
the same green as *price went up* means the primary action and a profitable position are
the same colour on a trading surface. Inverting the market convention to protect a palette
would cost a user money, and the convention is not negotiable.

**The purple→green Solana gradient — rejected twice over.** Gradient fills are already
banned below, and a violet-to-mint gradient on near-black is the exact look every
AI-generated dark crypto UI ships. The wordmark's chromatic split was moved *off* cyan and
magenta for that precise reason; reintroducing the same idea in Solana's own two colours
would undo that.

**`#9945FF` as accent *text* — rejected.** It measures 4.41:1 on `#08090a`, under AA. It
remains the brand hue of record and is used for non-text marks, but a figure or a label
set in it would fail. This is the same call the old document made when it refused white on
red at 3.99:1.

### What was chosen

Three values of one hue, each with a stated job and a measured contrast.

| Token | Value | Job | Measured |
|---|---|---|---|
| `--sol` | `#9945FF` | brand of record. Non-text marks only: HUD corner ticks, meter fill, avatar chain badge, focus ring, bloom tint, the moving rule under a pending toast. | 4.41:1 — **not for text** |
| `--sol-bright` | `#A970FF` | accent **text and figures** on ground or panel. Live-state marks. Hover on a filled control. | 6.1:1 on ground |
| `--sol-deep` | `#6B23C0` | the fill under a filled primary control. | white on it: **8.0:1** |
| `--sol-wash` | `#150A2B` | tint block behind a live mark. | — |

**Foreground on a filled control is white, not dark ink — and this inverts the previous
rule.** On pure red, white measured 3.99:1 and the fix belonged on the foreground. On
Solana violet the arithmetic flips: `#08090a` on `#9945FF` is 4.41:1 (fails), warm `--ink`
on it is 3.73:1 (fails), and pure white is 4.52:1 (passes, but thinly). Rather than ship a
4.52:1 primary action, the fill drops to `--sol-deep` and white on it measures 8.0:1. The
old note in this document said the fix belongs on the foreground; here it belonged on the
fill. Both times the rule was *measure it*, not *pick a side*.

**Glow is narrow and deliberate.** A generic drop shadow is a tell; a phosphor bloom is
this archetype's own lighting model. It is tinted violet, applied only to the accent,
never to a panel, and only once per screen — on the primary create action.

---

## Color

| Token | Value | Role | Changed |
|---|---|---|---|
| `--snow` | `#08090a` | page ground | no |
| `--snow-sunk` | `#050607` | input wells | no |
| `--sheet` | `#0e1013` | panels | no |
| `--sheet-raised` | `#15181c` | one level above a panel | no |
| `--ink` … `--ink-4` | `#ece9e3` → `#4f4d48` | text, warm-tinted, four steps | no |
| `--rule` | `#22262b` | hairlines; the structural element | no |
| `--rule-strong` | `#3a4048` | hover edge | no |
| `--sol` | `#9945FF` | **the** accent, non-text | **yes** |
| `--sol-bright` | `#A970FF` | accent text, hover | **yes** |
| `--sol-deep` | `#6B23C0` | filled control ground | **yes** |
| `--sol-wash` | `#150A2B` | accent tint block | **yes** |
| `--gain` | `#3fcf8a` | market direction, up | no |
| `--loss` | `#e84142` | market direction, down — **and now nothing else** | role narrowed |

The warm ink ramp stays warm. It was chosen so text sits in the same light as the
phosphor, and a violet phosphor over warm ink is a deliberate temperature contrast rather
than an accident — it is what keeps the surface from reading as a monochrome violet wash.

**Measured contrast, all AA or better** (lowest 4.78:1): ink 16.5:1 · ink-2 7.6:1 · ink-3
5.8:1 on ground and 5.5:1 on panel · `--sol-bright` 6.1:1 on ground · white on `--sol-deep`
8.0:1 · gain 9.5:1 · loss 5.0:1.

**Geometry is square** — `--r-panel` and `--r-control` are both 2px. Terminals do not
round their corners.

### State marks

Live / held / settled all ride the accent at different values, so the surface stays
single-hue outside of market direction. The structure is unchanged; only the hue moved.

| Mark | Colour | Wash |
|---|---|---|
| `.mark--sealed` | `--fjord` `#8d8a82` | `#17191c` |
| `.mark--held` | `--ochre` `#d98a2b` | `#2a1d08` |
| `.mark--settled` | `--sol-bright` `#A970FF` | `--sol-wash` |
| `.mark--live` | `--sol` `#9945FF` | `--sol-wash` |

### The allocation ramp

Eight fee buckets share one bar, so they must separate at 4px wide and survive greyscale.
The old ramp was anchored on red, which now means *loss* — so `--cat-creator: #e84142`
would have printed the creator's share in the colour of a losing position. Re-derived
around the violet, alternating value as well as hue so adjacent buckets differ in
lightness for a red-green colour-blind reader:

| Bucket | Value | Note |
|---|---|---|
| `--cat-creator` | `#9945FF` | the accent |
| `--cat-partner` | `#C08BFF` | light violet |
| `--cat-rewards` | `#6B23C0` | deep violet |
| `--cat-marketing` | `#D98A2B` | ochre — kept; the warm counterpoint the ramp needs |
| `--cat-buyback` | `#3E1F6B` | near-black violet |
| `--cat-liquidity` | `#6E8B93` | kept; cold grey-teal |
| `--cat-treasury` | `#8D8A82` | kept; neutral |
| `--cat-custom` | `#4F4D48` | kept; the floor |

No red anywhere in the ramp. That is the point.

---

## Type

Unchanged. System stacks. An Operate surface is well served by them, and character comes
from case, weight, tracking and rule rather than a webfont that must be fetched.

- `--face-ui` — system-ui stack. Everything.
- `--face-data` — `ui-monospace` stack, tabular figures. Every number.
- Wordmark — condensed heavy stack led by Avenir Next Condensed.

| Token | Size | Use |
|---|---|---|
| `--t-fine` | 12px | tracked uppercase labels. The floor. |
| `--t-base` | 15px | body and data |
| `--t-lead` | 32px | page lead, and the wordmark |

**Nothing below 12px, ever.** Adding a step to this table to launder a small value is the
exact move the floor exists to stop.

Two cascade rules learned the hard way and still true:

- **Never set `font-size` on `html`.** `html` *is* the root, so it rebases every `rem`
  token — a 12px floor silently became 11.25px. It lives on `body`.
- **No raw Tailwind size classes** (`text-xs`, `text-2xl`, `text-[10px]`). Use
  `text-[length:var(--t-*)]`.

### Wordmark

The chromatic split is the mark's identity and stays. Channel A moves from warm red
to `--sol`; channel B stays `--fjord` `#8d8a82`.

**Channel B must not become Solana green.** A violet/mint split is the vendor gradient in
disguise and is the generic look this mark was drawn to avoid. The neutral second channel
is what makes the split read as a signal tear rather than a logo animation.

The channel-tear fires briefly every 7s; disabled under `prefers-reduced-motion`.

---

## Layout

Unchanged.

- **Square.** No border radius anywhere. The sheet is printed, not rounded.
- **Hairlines carry structure.** One `--rule` line separates sections; boxes do not each
  draw their own outline. No card inside a card.
- **Rail, not tabs,** for navigation. Tabs are reserved for views of the *same* subject.
- **Tabular figures always.** Digits align down a column and must not reflow width as
  they tick — which on Solana they will, at 400ms slots, far more often than before.
- **Reversal, not size,** for a control that outranks its neighbours.

### Surface primitives

`.panel` · `.chip` · `.seg` · `.tabbar`/`.tab` · `.meter` · `.plot` · `.avatar` ·
`.card-link` · `.hud` · `.emissive` · `.reversed` · `.field` · `.label` · `.lead` ·
`.pill` · `.kbd` · `.toast` · `.skip-link`

All unchanged in structure. Four consume the accent and therefore change value only:

| Primitive | Accent use |
|---|---|
| `.hud::before/::after` | corner ticks in `--sol` at 0.55 opacity |
| `.meter__fill` | `--sol`; `--gain` when complete |
| `.tab[aria-selected]` | underline rule in `--sol` |
| `.cta-emissive` | `--sol-deep` fill, white text, violet bloom |

**The meter is never drawn without its denominator.** A bar with no target cannot
distinguish 90% of a small goal from 9% of a large one, which on a launch page is the
entire question.

**The avatar's chain badge** carries the Solana mark,
and the badge stays — a launchpad that will eventually index more than one network needs
the slot.

---

## Motion

Unchanged, and it must mean something.

- Color transitions on interactive elements. Nothing else.
- **No hover-scale on anything that signs a transaction.** A control that moves under the
  cursor undercuts the seriousness of what it commits to.
- Loading uses shape-matched skeletons so layout does not jump on arrival.
- The indeterminate toast bar stays indeterminate. The app cannot know how long a
  confirmation or a proof will take, and a progress bar that pretends to would be lying.

One addition earned by the platform: **`.ticked`, the single-flash on a changed figure,
now fires far more often**, because account subscriptions push updates at slot cadence
rather than on a poll interval. Coalesce updates to at most one flash per figure per
400ms, or a dense table becomes a strobe. This is a real regression risk that did not
exist at 2-second block times.

---

## Anti-patterns

Banned here, and the detector enforces most of them:

gradient fills · decorative glow and colored shadows (the single `.cta-emissive` bloom is
the stated exception) · glassmorphism / backdrop blur · border radius · pulsing dots ·
particle backdrops · Inter / Roboto / Geist / Plus Jakarta / Space Grotesk / Fraunces ·
text below 12px · cards inside cards · numbered section labels · third-party accents left
at their vendor default.

Carried forward:

- **No progress bar without its target.**
- **No figure the contracts do not produce.** Vote counts, holder counts on a sealed
  round, a 24h change with under a day of history: if the chain does not say it, the
  surface does not print it.

Added on this pass:

- **No purple→green gradient, in any form, anywhere.** Including the wordmark, including
  a chart fill, including a hover state. It is the vendor gradient and it is the generic
  look.
- **Red is `--loss` and nothing else.** No red primary action, no red brand mark, no red
  category swatch. The accent left that hue for a reason and must not creep back into it.
- **Wallet-adapter and any wallet modal must be themed to these tokens.** The stock
  wallet-adapter UI ships rounded corners, its own purple and a blur backdrop — three
  bans in one component. Theme it or replace it; do not ship it at vendor default. This
  is the same finding the old document recorded about RainbowKit's stock blue.

---

## Verification

```bash
npx impeccable detect apps/web/src
npx impeccable detect http://localhost:5173
```

Both must return zero. Findings get fixed, never suppressed — the runtime scan catches
what the static one cannot, so run both.

Add one manual check that the detector cannot make: **open a launch page with a live curve
and confirm that no violet element sits adjacent to a `--gain` or `--loss` figure in a way
that could be misread as direction.** The hue separation is the whole reason for this
change and it is only real if it survives the dense case.
