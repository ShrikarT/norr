import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCluster } from "../lib/status";
import {
  CT_EVIDENCE,
  PROGRAM_IDS,
  PROGRAM_LABELS,
  ZK_PROOF_PROGRAM,
  explorerAddress,
  explorerTx,
  short,
  type ProgramKey,
} from "../lib/config";

/* ------------------------------------------------------------------ motion */

/** Heavy fade-up on viewport entry: translate-y-16 blur-md opacity-0 → resolved. */
function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "figure";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref as never}
      className={`lp-reveal ${className}`}
      data-shown={shown}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/** B11 tagline — each word resolves from muted to full ink, driven by scroll
 *  position through a requestAnimationFrame loop that only runs while the
 *  block is on screen. */
function ScrollTagline({ lines }: { lines: readonly string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let running = false;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (vh * 0.55)));
      setProgress(p);
      if (running) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      const on = Boolean(entries[0]?.isIntersecting);
      if (on && !running) {
        running = true;
        raf = requestAnimationFrame(tick);
      } else if (!on && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      running = false;
      cancelAnimationFrame(raf);
    };
  }, []);
  const words = lines.flatMap((l) => l.split(" "));
  const activeCount = Math.round(progress * words.length);
  let idx = 0;
  return (
    <div className="lp-tagline" ref={ref} aria-label={lines.join(" ")}>
      {lines.map((line, li) => (
        <p key={li}>
          {line.split(" ").map((w, wi) => {
            const i = idx++;
            return (
              <span key={wi} data-on={i < activeCount}>
                {w}{" "}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

/** Tabular figure that counts up once it enters the viewport. */
function CountUp({ to, duration = 1400 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 4);
        setValue(Math.round(to * eased));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return (
    <span ref={ref} className="tabular">
      {value}
    </span>
  );
}

/* --------------------------------------------------------------- island nav */

function IslandNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 24));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);
  const close = useCallback(() => setOpen(false), []);
  const links: readonly (readonly [string, string])[] = [
    ["#how", "How it works"],
    ["#devnet", "Devnet evidence"],
    ["#programs", "Programs"],
    ["#faq", "FAQ"],
  ];
  return (
    <>
      <header className={`lp-island ${scrolled ? "lp-island--scrolled" : ""}`}>
        <a className="lp-island__brand" href="#top">
          <span className="wordmark">NORR</span>
        </a>
        <nav className="lp-island__links" aria-label="Landing">
          {links.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <Link className="lp-island__cta" to="/launches">
          Open the app
        </Link>
        <button
          className="lp-burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="lp-burger__line" data-open={open} data-pos="a" />
          <span className="lp-burger__line" data-open={open} data-pos="b" />
        </button>
      </header>

      <div className="lp-overlay" data-open={open} aria-hidden={!open}>
        <nav className="lp-overlay__links" aria-label="Menu">
          {links.map(([href, label], i) => (
            <a key={href} href={href} style={{ transitionDelay: open ? `${120 + i * 60}ms` : "0ms" }} onClick={close}>
              {label}
            </a>
          ))}
          <Link
            to="/launches"
            className="lp-overlay__app"
            style={{ transitionDelay: open ? `${120 + links.length * 60}ms` : "0ms" }}
            onClick={close}
          >
            Open the app →
          </Link>
        </nav>
        <p className="lp-overlay__foot" style={{ transitionDelay: open ? "440ms" : "0ms" }}>
          Private contribution. Public settlement.
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

/** Full-bleed matte-painting break with an overlaid serif quote and a mono
 *  archive caption — the hero's visual language carried mid-page. */
function ArtBreak({
  src,
  quote,
  caption,
  flip = false,
}: {
  src: string;
  quote: string;
  caption: string;
  flip?: boolean;
}) {
  return (
    <figure className="lp-break" data-flip={flip}>
      <img src={src} alt="" loading="lazy" />
      <div className="lp-break__shade" aria-hidden="true" />
      <Reveal className="lp-break__quote">
        <blockquote>{quote}</blockquote>
      </Reveal>
      <figcaption className="lp-break__cap">{caption}</figcaption>
    </figure>
  );
}

/** Animated micro-visualizations for the problem cards. Pure CSS loops,
 *  paused under prefers-reduced-motion. */
function VizRace() {
  return (
    <div className="lp-viz" aria-hidden="true">
      <span className="lp-viz__lane" />
      <span className="lp-viz__runner lp-viz__runner--user" />
      <span className="lp-viz__runner lp-viz__runner--bot" />
      <span className="lp-viz__runner lp-viz__runner--bot2" />
      <span className="lp-viz__cap lp-viz__cap--l">your tx</span>
      <span className="lp-viz__cap lp-viz__cap--r">bots</span>
    </div>
  );
}

function VizBars() {
  return (
    <div className="lp-viz lp-viz--bars" aria-hidden="true">
      <span className="lp-viz__bar lp-viz__bar--whale" />
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="lp-viz__bar" style={{ animationDelay: `${0.9 + i * 0.35}s` }} />
      ))}
      <span className="lp-viz__cap lp-viz__cap--l">whale</span>
      <span className="lp-viz__cap lp-viz__cap--r">copied</span>
    </div>
  );
}

function VizRedacted() {
  return (
    <div className="lp-viz lp-viz--sheet" aria-hidden="true">
      {["a7f2", "c04d", "91be", "e6a3"].map((h, i) => (
        <span key={h} className="lp-viz__row" style={{ animationDelay: `${i * 0.5}s` }}>
          <code>row_{i + 1}</code>
          <i className="lp-viz__redact" />
          <code className="lp-viz__hash">0x{h}…?</code>
        </span>
      ))}
      <span className="lp-viz__cap lp-viz__cap--r">operator db</span>
    </div>
  );
}

/** Mini terminal readout — the mono “what the protocol sees” chip. */
function Term({ lines, tone }: { lines: readonly ReactNode[]; tone?: "ok" | "warn" }) {
  return (
    <div className="lp-term" data-tone={tone} aria-hidden="true">
      <span className="lp-term__bar">
        <i />
        <i />
        <i />
      </span>
      <code>
        {lines.map((l, i) => (
          <span className="lp-term__line" key={i}>
            {l}
          </span>
        ))}
        <span className="lp-term__cursor" />
      </code>
    </div>
  );
}

/** Infinite mono ticker of protocol vocabulary. */
function Ticker() {
  const terms = [
    "twisted elgamal",
    "128-bit range proofs",
    "merkle settlement",
    "constant product curve",
    "fail closed by design",
    "token-2022 confidential transfers",
    "native zk proof program",
    "timelocked refunds",
    "no fallback ledger",
  ];
  const row = terms.map((t, i) => (
    <span key={i}>
      {t}
      <i aria-hidden="true">·</i>
    </span>
  ));
  return (
    <div className="lp-ticker" aria-hidden="true">
      <div className="lp-ticker__row">
        {row}
        {row}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- data */

const PROGRAM_ROLES: Record<ProgramKey, string> = {
  launch: "Launch lifecycle and immutable raise parameters",
  market: "Constant product bonding curve with exact integer pricing",
  fees: "Basis point fee accrual, order independent release",
  boards: "Curated community desks with snapshotted terms",
  social: "Signed on chain threads, comments, and profiles",
  claim: "Merkle settlement and timelocked refund escrows",
  wrap: "Confidential token adapter, fail closed until proven",
};

const FAQ: readonly (readonly [string, string])[] = [
  [
    "What does Norr do?",
    "Norr runs token launches on Solana in two phases. While a raise is open, contribution amounts are encrypted with Token 2022 confidential transfers. When it closes, allocations settle through a public Merkle commitment into a bonding curve market anyone can verify.",
  ],
  [
    "Why hide contribution amounts?",
    "Public contribution sizes leak intent. Bots copy large wallets, snipe allocations, and front run price discovery before a market even opens. Norr encrypts the amount while keeping participants, timing, and aggregate backing visible, so the raise stays auditable without being exploitable.",
  ],
  [
    "Is this a mixer or an anonymity tool?",
    "No. Wallets, timing, and the account graph stay public. Only the contribution amount is confidential, and only while the raise is open. Settlement is fully public and every allocation is verifiable by the claimant.",
  ],
  [
    "What actually runs on chain today?",
    "Five of the six steps of the confidential pipeline are confirmed on Solana Devnet: mint creation, account configuration, ElGamal key derivation, zero knowledge proof verification on the native proof program, and an encrypted deposit with an applied pending balance. The evidence addresses on this page are re read live from RPC.",
  ],
  [
    "Why is the confidential transfer itself gated?",
    "The canonical Token 2022 program deployed on public Solana clusters is compiled without the zk ops feature, so its confidential Transfer handler rejects every instruction. Norr keeps that path fail closed rather than substituting an unverified private ledger. When the upstream build enables zk ops, the pipeline resumes with no architecture change.",
  ],
  [
    "What stops the protocol from faking balances?",
    "There is no fallback ledger. Private value paths require an on chain capability proof before they enable, and the web app simulates every write against the cluster before requesting a signature. If the chain cannot confirm something, the interface does not display it.",
  ],
  [
    "Who holds contributed funds during a raise?",
    "A program derived sale vault. The operator can decrypt amounts for the settlement tally but cannot redirect funds, and a timelocked public refund path exists if settlement misses its deadline.",
  ],
  [
    "Can I try it now?",
    "Yes. The app runs against Solana Devnet: connect a wallet to read live balances and history, quote trades with the exact program arithmetic, verify Merkle proofs locally, and inspect the confidential transfer evidence directly on the explorer.",
  ],
];

/* --------------------------------------------------------------------- page */

export function Landing() {
  const c = useCluster();
  const ev = c.ctEvidence;
  const evidenceLive = ev.checked && ev.mintLive && ev.accountLive && ev.proofContextsLive === 3;

  return (
    <div className="lp" id="top">
      <div className="lp-grain" aria-hidden="true" />
      <IslandNav />

      {/* ------------------------------------------------------------ hero */}
      <section className="lp-hero">
        <div className="lp-hero__art" aria-hidden="true">
          <img src="/hero-aurora.webp" alt="" loading="eager" fetchPriority="high" />
          <div className="lp-hero__fade" />
        </div>
        <div className="lp-hero__inner">
          <p className="lp-kicker lp-rise" style={{ animationDelay: "80ms" }}>
            <SolanaMark /> Built on Solana · live against Devnet
          </p>
          <h1 className="lp-hero__title lp-rise" style={{ animationDelay: "180ms" }}>
            Private <em>contribution</em>.
            <br />
            Public <em>settlement</em>.
          </h1>
          <p className="lp-hero__sub lp-rise" style={{ animationDelay: "300ms" }}>
            Norr is a token launch protocol where contribution amounts stay encrypted while a raise is open, then
            settle into public bonding curve markets that anyone can verify.
          </p>
          <div className="lp-hero__cta lp-rise" style={{ animationDelay: "420ms" }}>
            <Link className="lp-btn lp-btn--primary" to="/launches">
              Open the app
            </Link>
            <a className="lp-btn lp-btn--ghost" href="#devnet">
              See the Devnet evidence
            </a>
          </div>
          <HeroPanel evidenceLive={evidenceLive} checked={ev.checked} slot={c.slot} connected={c.connected} />
        </div>
        <a className="lp-hero__scroll" href="#stats" aria-label="Scroll to content">
          <span />
        </a>
      </section>

      {/* ------------------------------------------------------- stat strip */}
      <section className="lp-strip" id="stats">
        <Reveal className="lp-strip__grid">
          <div className="lp-stat">
            <span className="lp-stat__n">
              <CountUp to={7} duration={900} />
            </span>
            <span className="lp-stat__l">Anchor programs, one domain each</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat__n">
              <CountUp to={22} duration={1100} />
            </span>
            <span className="lp-stat__l">Passing protocol test suites</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat__n">
              <CountUp to={3} duration={800} />
            </span>
            <span className="lp-stat__l">ZK proofs verified on the native proof program</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat__n">
              <CountUp to={5} duration={900} />
              <span className="lp-stat__of">/6</span>
            </span>
            <span className="lp-stat__l">Confidential pipeline steps live on Devnet</span>
          </div>
        </Reveal>
      </section>

      <Ticker />

      {/* ---------------------------------------------------------- problem */}
      <section className="lp-section" id="why">
        <Reveal>
          <span className="lp-label">§01 — The problem</span>
          <h2 className="lp-h2">
            Public raises leak <em>everything</em> before the market exists
          </h2>
        </Reveal>
        <div className="lp-cols">
          <Reveal delay={0} className="lp-card lp-tick">
            <span className="lp-sublabel">— §01.1 / speed</span>
            <VizRace />
            <h3>Front running</h3>
            <p>Visible contribution flow lets bots snipe allocations and position against a launch before price discovery begins.</p>
          </Reveal>
          <Reveal delay={120} className="lp-card lp-tick">
            <span className="lp-sublabel">— §01.2 / intent</span>
            <VizBars />
            <h3>Size signaling</h3>
            <p>Large contributions are copied the moment they land. Wallets telegraph intent they never chose to publish.</p>
          </Reveal>
          <Reveal delay={240} className="lp-card lp-tick">
            <span className="lp-sublabel">— §01.3 / trust</span>
            <VizRedacted />
            <h3>Unverifiable settlement</h3>
            <p>Many launchpads settle off chain or by operator spreadsheet. Contributors cannot independently check their own allocation.</p>
          </Reveal>
        </div>
        <Reveal delay={120}>
          <p className="lp-answer">
            Norr encrypts the one number that causes the damage — the amount — and makes the one thing that needs
            trust, settlement, a deterministic on chain commitment.
          </p>
        </Reveal>
      </section>

      {/* ------------------------------------------------------------- how */}
      <section className="lp-section" id="how">
        <Reveal>
          <span className="lp-label">§02 — How it works</span>
          <h2 className="lp-h2">
            Three phases. One <em>verifiable</em> lifecycle.
          </h2>
        </Reveal>
        <ol className="lp-steps">
          <Reveal as="li" delay={0}>
            <div className="lp-step__rail">
              <span className="lp-step__node" />
            </div>
            <div className="lp-step__body">
              <span className="lp-sublabel">— §02.1 / encrypted</span>
              <h3>Contribute privately</h3>
              <p>
                Contributions move as Token 2022 confidential transfers: Twisted ElGamal ciphertexts with equality,
                validity, and 128 bit range proofs verified by Solana's native ZK proof program. Participants and
                timing stay public; the amount does not.
              </p>
            </div>
            <Term
              lines={[
                <>
                  amount&nbsp;&nbsp;<i className="lp-term__redact" /> <em>elgamal</em>
                </>,
                <>proofs&nbsp;&nbsp;eq ✓ · validity ✓ · range ✓</>,
                <>sender&nbsp;&nbsp;public · timing public</>,
              ]}
            />
          </Reveal>
          <Reveal as="li" delay={140}>
            <div className="lp-step__rail">
              <span className="lp-step__node" />
            </div>
            <div className="lp-step__body">
              <span className="lp-sublabel">— §02.2 / verifiable</span>
              <h3>Settle publicly</h3>
              <p>
                When the raise closes, allocations commit to a domain separated Merkle root on chain. Every claimant
                verifies their own leaf locally before claiming, and a timelocked refund escrow covers a missed
                settlement deadline.
              </p>
            </div>
            <Term
              tone="ok"
              lines={[
                <>root&nbsp;&nbsp;&nbsp;&nbsp;3fca…9b21 committed</>,
                <>
                  leaf&nbsp;&nbsp;&nbsp;&nbsp;verified locally <em data-ok>✓</em>
                </>,
                <>refund&nbsp;&nbsp;timelocked escrow armed</>,
              ]}
            />
          </Reveal>
          <Reveal as="li" delay={280}>
            <div className="lp-step__rail">
              <span className="lp-step__node" />
            </div>
            <div className="lp-step__body">
              <span className="lp-sublabel">— §02.3 / autonomous</span>
              <h3>Trade on the curve</h3>
              <p>
                Settled tokens trade on an autonomous constant product bonding curve with exact integer arithmetic.
                Every fee routes through a basis point split router whose entitlements are order independent and never
                move backward.
              </p>
            </div>
            <Term
              lines={[
                <>invariant&nbsp;&nbsp;k = x · y held</>,
                <>pricing&nbsp;&nbsp;&nbsp;&nbsp;exact Q64 integer math</>,
                <>fees&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;bps split · never backward</>,
              ]}
            />
          </Reveal>
        </ol>
      </section>

      <ArtBreak
        src="/art-caravan.webp"
        quote="The amount is the only secret. Everyone can see who walked — no one can weigh what they carried."
        caption={"the contribution window\nsolana devnet"}
      />

      {/* --------------------------------------------------------- tagline */}
      <section className="lp-section lp-section--tagline">
        <ScrollTagline lines={["If the chain cannot prove it,", "Norr will not show it."]} />
        <Reveal delay={200}>
          <p className="lp-tagline__sub">
            No invented figures, no fake success paths, no fallback ledger. Every write simulates against the cluster
            first, and every gated feature says exactly why it is gated.
          </p>
        </Reveal>
      </section>

      {/* ---------------------------------------------------------- devnet */}
      <section className="lp-section" id="devnet">
        <Reveal>
          <span className="lp-label">§03 — Devnet evidence</span>
          <h2 className="lp-h2">
            The confidential pipeline is <em>real</em>, and you can check it
          </h2>
          <p className="lp-copy">
            The addresses below were created by this project on Solana Devnet and are re read from RPC every time this
            page loads — the status column is a live result, not a screenshot.
          </p>
        </Reveal>
        <Reveal delay={140} className="lp-evidence">
          <EvRow label="Confidential mint with CT extension" addr={CT_EVIDENCE.mint} live={ev.checked ? ev.mintLive : null} />
          <EvRow label="Configured confidential token account" addr={CT_EVIDENCE.tokenAccount} live={ev.checked ? ev.accountLive : null} />
          <EvRow label="Equality proof context" addr={CT_EVIDENCE.equalityProofContext} live={ev.checked ? ev.proofContextsLive >= 1 : null} />
          <EvRow label="Validity proof context (3 handles)" addr={CT_EVIDENCE.validityProofContext} live={ev.checked ? ev.proofContextsLive >= 2 : null} />
          <EvRow label="Range proof context (128 bit)" addr={CT_EVIDENCE.rangeProofContext} live={ev.checked ? ev.proofContextsLive >= 3 : null} />
          <EvRow label="Encrypted deposit, applied on chain" tx={CT_EVIDENCE.depositTx} live={null} />
        </Reveal>
        <Reveal delay={200}>
          <p className="lp-copy lp-fine">
            Proof contexts live on the native proof program <code>{short(ZK_PROOF_PROGRAM, 12, 4)}</code>. The final
            pipeline step, the confidential transfer itself, is gated — see below.
          </p>
        </Reveal>
      </section>

      {/* ---------------------------------------------------------- status */}
      <section className="lp-section" id="status">
        <Reveal>
          <span className="lp-label">§04 — Capability status</span>
          <h2 className="lp-h2">
            What works today, and the one thing that is <em>gated</em>
          </h2>
        </Reveal>
        <div className="lp-status">
          <Reveal className="lp-status__col lp-tick">
            <span className="lp-pill lp-pill--live">
              <span className="lp-dot lp-dot--on" /> working now
            </span>
            <ul className="lp-checklist">
              <li>Bonding curve quoting and trading arithmetic, byte exact with the program</li>
              <li>Merkle settlement building and local proof verification in the browser</li>
              <li>Fee split accounting with exact remainder assignment</li>
              <li>Live wallet, balance, and transaction reads from any Solana RPC</li>
              <li>Confidential setup pipeline, steps one through five, confirmed on Devnet</li>
              <li>Per program deployment probing — the app never assumes a program exists</li>
            </ul>
          </Reveal>
          <Reveal delay={140} className="lp-status__col lp-status__col--gated">
            <span className="lp-stamp" aria-hidden="true">
              fail closed
            </span>
            <span className="lp-pill lp-pill--held">
              <span className="lp-dot lp-dot--warn" /> gated, fail closed
            </span>
            <ul>
              <li>
                The confidential transfer instruction itself. The canonical Token 2022 program on public clusters is
                compiled without <code>zk-ops</code>, so its Transfer handler rejects every instruction.
              </li>
              <li>
                Norr refuses to fake it: wrap, private transfer, withdraw, and unwrap stay locked behind an on chain
                capability proof (<code>P0Required</code>) rather than falling back to an unverified ledger.
              </li>
              <li>When the upstream build enables zk ops, the pipeline resumes with zero architecture changes.</li>
            </ul>
          </Reveal>
        </div>
      </section>

      <ArtBreak
        src="/art-hall.webp"
        quote="Settlement is a public act — a root anyone can recompute, a ledger no operator can quietly edit."
        caption={"the settlement record\nmerkle commitment"}
        flip
      />

      {/* -------------------------------------------------------- programs */}
      <section className="lp-section" id="programs">
        <Reveal>
          <span className="lp-label">§05 — Architecture</span>
          <h2 className="lp-h2">
            Seven programs. One domain <em>each</em>.
          </h2>
        </Reveal>
        <div className="lp-registry">
          <Reveal className="lp-registry__head" aria-hidden="true">
            <span>idx</span>
            <span>program</span>
            <span>domain</span>
            <span>declared id</span>
            <span />
          </Reveal>
          {(Object.keys(PROGRAM_IDS) as ProgramKey[]).map((k, i) => (
            <Reveal key={k} delay={i * 70}>
              <a className="lp-regrow" href={explorerAddress(PROGRAM_IDS[k])} target="_blank" rel="noreferrer">
                <span className="lp-regrow__idx">{String(i + 1).padStart(2, "0")}</span>
                <span className="lp-regrow__name">{PROGRAM_LABELS[k]}</span>
                <span className="lp-regrow__role">{PROGRAM_ROLES[k]}</span>
                <span className="lp-regrow__addr address">{short(PROGRAM_IDS[k], 8, 6)}</span>
                <span className="lp-regrow__arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            </Reveal>
          ))}
        </div>
        <Reveal delay={160}>
          <p className="lp-copy lp-fine">
            Anchor programs with declared canonical IDs. The app probes each ID against the connected RPC and only
            enables write actions where a program is actually executable.
          </p>
        </Reveal>
      </section>

      {/* ------------------------------------------------------------- faq */}
      <section className="lp-section" id="faq">
        <Reveal>
          <span className="lp-label">§06 — FAQ</span>
          <h2 className="lp-h2">
            Direct <em>answers</em>
          </h2>
        </Reveal>
        <Reveal delay={120} className="lp-faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <div className="lp-faq__body">
                <p>{a}</p>
              </div>
            </details>
          ))}
        </Reveal>
      </section>

      {/* ------------------------------------------------------- final cta */}
      <section className="lp-final">
        <div className="lp-final__art" aria-hidden="true">
          <img src="/hero-aurora.webp" alt="" loading="lazy" />
          <div className="lp-final__fade" />
        </div>
        <Reveal className="lp-final__inner">
          <h2 className="lp-h2 lp-final__h">
            See it <em>running</em> against Devnet
          </h2>
          <p className="lp-copy">
            Browse launches, quote trades with the exact on chain arithmetic, verify a Merkle proof in your browser,
            and inspect the confidential transfer evidence live.
          </p>
          <Link className="lp-btn lp-btn--primary lp-btn--xl" to="/launches">
            Open the app
          </Link>
        </Reveal>
      </section>

      <footer className="lp-footer">
        <div>
          <span className="wordmark">NORR</span>
          <p className="fine muted">Private contribution. Public settlement.</p>
        </div>
        <nav aria-label="Footer">
          <a href="https://github.com/ShrikarT/norr" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <Link to="/private">Devnet evidence</Link>
          <Link to="/settings">Protocol status</Link>
        </nav>
        <p className="fine muted">
          Devnet software. Nothing here is an offer of securities or investment advice. Private paths remain disabled
          until the connected cluster proves the required Token 2022 capability.
        </p>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------- pieces */

function SolanaMark() {
  return (
    <svg className="lp-solmark" width="14" height="12" viewBox="0 0 646 512" aria-hidden="true">
      <path
        fill="currentColor"
        d="M108 388c4-4 10-7 16-7h500c10 0 15 12 8 19l-99 98c-4 4-10 7-16 7H17c-10 0-15-12-8-19l99-98Zm0-369c4-4 10-7 16-7h500c10 0 15 12 8 19l-99 98c-4 4-10 7-16 7H17c-10 0-15-12-8-19l99-98Zm430 184c-4-4-10-7-16-7H22c-10 0-15 12-8 19l99 98c4 4 10 7 16 7h500c10 0 15-12 8-19l-99-98Z"
      />
    </svg>
  );
}

function CardIcon({ d }: { d: string }) {
  return (
    <span className="lp-card__icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="currentColor" d={d} />
      </svg>
    </span>
  );
}

function HeroPanel({
  evidenceLive,
  checked,
  slot,
  connected,
}: {
  evidenceLive: boolean;
  checked: boolean;
  slot: number | null;
  connected: boolean;
}) {
  return (
    <div className="lp-hero__panel lp-rise" style={{ animationDelay: "560ms" }} role="img" aria-label="Live protocol status readout">
      <div className="lp-hero__panel-head">
        <span className="lp-label">Live readout</span>
        <span className="lp-dot lp-dot--on" />
      </div>
      <div className="lp-hero__panel-row">
        <span className="lp-label">Devnet RPC</span>
        <span className="tabular" data-tone={connected ? "on" : "off"}>
          {connected ? `connected · slot ${slot?.toLocaleString() ?? "…"}` : checked ? "unreachable" : "connecting…"}
        </span>
      </div>
      <div className="lp-hero__panel-row">
        <span className="lp-label">Confidential setup evidence</span>
        <span className="tabular" data-tone={evidenceLive ? "on" : undefined}>
          {!checked ? "re verifying…" : evidenceLive ? "5 / 5 artifacts live on chain" : "partially verified"}
        </span>
      </div>
      <div className="lp-hero__panel-row">
        <span className="lp-label">Private transfer execution</span>
        <span className="tabular" data-tone="warn">
          fail closed · upstream zk ops disabled
        </span>
      </div>
      <div className="lp-hero__panel-row">
        <span className="lp-label">Fallback ledger</span>
        <span className="tabular">none, by design</span>
      </div>
    </div>
  );
}

function EvRow({ label, addr, tx, live }: { label: string; addr?: string; tx?: string; live: boolean | null }) {
  const href = addr ? explorerAddress(addr) : tx ? explorerTx(tx) : "#";
  const display = addr ?? tx ?? "";
  return (
    <a className="lp-evrow" href={href} target="_blank" rel="noreferrer">
      <span className="lp-evrow__label">{label}</span>
      <span className="address">{short(display, 10, 6)}</span>
      <span className="lp-evrow__live">
        {live === null ? (
          <span className="muted fine">explorer ↗</span>
        ) : live ? (
          <span className="lp-live-pill">
            <span className="lp-dot lp-dot--on" /> live on chain
          </span>
        ) : (
          <span className="loss fine">not found</span>
        )}
      </span>
    </a>
  );
}
