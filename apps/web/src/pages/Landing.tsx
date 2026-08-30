import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCluster } from "../lib/status";
import { CT_EVIDENCE, PROGRAM_IDS, PROGRAM_LABELS, ZK_PROOF_PROGRAM, explorerAddress, explorerTx, short, type ProgramKey } from "../lib/config";

/* ---------------------------------------------------------------- reveal */

function Reveal({ children, delay = 0, as: Tag = "div" }: { children: ReactNode; delay?: number; as?: "div" | "section" }) {
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
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className="lp-reveal" data-shown={shown} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/** B11 tagline: words activate one at a time as the block scrolls into view. */
function TaglineReveal({ lines }: { lines: readonly string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const words = lines.flatMap((l, i) => l.split(" ").map((w) => ({ w, line: i })));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !timer) {
          timer = setInterval(() => {
            setActive((n) => {
              if (n >= words.length) {
                if (timer) clearInterval(timer);
                return n;
              }
              return n + 1;
            });
          }, 70);
        }
      },
      { rootMargin: "0px 0px -25% 0px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, [words.length]);
  let idx = 0;
  return (
    <div className="lp-tagline" ref={ref} aria-label={lines.join(" ")}>
      {lines.map((line, li) => (
        <p key={li}>
          {line.split(" ").map((w, wi) => {
            const i = idx++;
            return (
              <span key={wi} data-on={i < active}>
                {w}{" "}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- page */

const PROGRAM_ROLES: Record<ProgramKey, string> = {
  launch: "Launch lifecycle and immutable raise parameters",
  market: "Constant product bonding curve with exact integer pricing",
  fees: "Basis point fee accrual, order independent release",
  boards: "Curated community desks with snapshotted terms",
  social: "Signed on chain threads, comments, and profiles",
  claim: "Merkle settlement and timelocked refund escrows",
  wrap: "Confidential token adapter, fail closed until proven",
};

const FAQ: readonly (readonly [string, ReactNode])[] = [
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

export function Landing() {
  const c = useCluster();
  const ev = c.ctEvidence;
  const evidenceLive = ev.checked && ev.mintLive && ev.accountLive && ev.proofContextsLive === 3;

  return (
    <div className="lp">
      <header className="lp-nav">
        <span className="wordmark">NORR</span>
        <nav className="lp-nav__links" aria-label="Landing">
          <a href="#how">How it works</a>
          <a href="#devnet">Devnet evidence</a>
          <a href="#programs">Programs</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link className="button button--primary" to="/launches">
          Open the app
        </Link>
      </header>

      {/* hero */}
      <section className="lp-hero">
        <p className="label lp-hero__kicker">
          <SolanaMark /> Built on Solana · live against Devnet
        </p>
        <h1 className="lp-hero__title">
          Private contribution.
          <br />
          Public settlement.
        </h1>
        <p className="lp-hero__sub">
          Norr is a token launch protocol where contribution amounts stay encrypted while a raise is open, then settle
          into public bonding curve markets that anyone can verify.
        </p>
        <div className="lp-hero__cta">
          <Link className="button button--primary lp-cta" to="/launches">
            Open the app
          </Link>
          <a className="button button--ghost" href="#devnet">
            See the Devnet evidence
          </a>
        </div>
        <p className="lp-hero__proof">
          7 Anchor programs · 22 passing tests · zero knowledge proofs verified on Solana's native proof program
        </p>
        <HeroPanel evidenceLive={evidenceLive} checked={ev.checked} slot={c.slot} connected={c.connected} />
      </section>

      {/* problem → solution */}
      <Reveal as="section">
        <section className="lp-section" id="why">
          <span className="label">The problem</span>
          <h2 className="lp-h2">Public raises leak everything before the market exists</h2>
          <div className="lp-cols">
            <div className="lp-card">
              <span className="label">Front running</span>
              <p>Visible contribution flow lets bots snipe allocations and position against a launch before price discovery begins.</p>
            </div>
            <div className="lp-card">
              <span className="label">Size signaling</span>
              <p>Large contributions are copied the moment they land. Wallets telegraph intent they never chose to publish.</p>
            </div>
            <div className="lp-card">
              <span className="label">Unverifiable settlement</span>
              <p>Many launchpads settle off chain or by operator spreadsheet. Contributors cannot independently check their own allocation.</p>
            </div>
          </div>
          <p className="lp-answer">
            Norr encrypts the one number that causes the damage — the amount — and makes the one thing that needs trust,
            settlement, a deterministic on chain commitment.
          </p>
        </section>
      </Reveal>

      {/* how it works */}
      <Reveal as="section">
        <section className="lp-section" id="how">
          <span className="label">How it works</span>
          <h2 className="lp-h2">Three phases, one verifiable lifecycle</h2>
          <ol className="lp-steps">
            <li>
              <span className="lp-step__n">01</span>
              <div>
                <h3>Contribute privately</h3>
                <p>
                  Contributions move as Token 2022 confidential transfers: Twisted ElGamal ciphertexts with equality,
                  validity, and 128 bit range proofs verified by Solana's native ZK proof program. Participants and
                  timing stay public; the amount does not.
                </p>
              </div>
            </li>
            <li>
              <span className="lp-step__n">02</span>
              <div>
                <h3>Settle publicly</h3>
                <p>
                  When the raise closes, allocations commit to a domain separated Merkle root on chain. Every claimant
                  verifies their own leaf locally before claiming, and a timelocked refund escrow covers a missed
                  settlement deadline.
                </p>
              </div>
            </li>
            <li>
              <span className="lp-step__n">03</span>
              <div>
                <h3>Trade on the curve</h3>
                <p>
                  Settled tokens trade on an autonomous constant product bonding curve with exact integer arithmetic.
                  Every fee routes through a basis point split router whose entitlements are order independent and never
                  move backward.
                </p>
              </div>
            </li>
          </ol>
        </section>
      </Reveal>

      {/* tagline reveal */}
      <section className="lp-section lp-section--tagline">
        <TaglineReveal
          lines={["If the chain cannot prove it,", "Norr will not show it."]}
        />
        <p className="lp-tagline__sub">
          No invented figures, no fake success paths, no fallback ledger. Every write simulates against the cluster
          first, and every gated feature says exactly why it is gated.
        </p>
      </section>

      {/* devnet evidence */}
      <Reveal as="section">
        <section className="lp-section" id="devnet">
          <span className="label">Devnet evidence</span>
          <h2 className="lp-h2">The confidential pipeline is real, and you can check it</h2>
          <p className="lp-copy">
            The addresses below were created by this project on Solana Devnet and are re read from RPC every time this
            page loads — the status column is a live result, not a screenshot.
          </p>
          <div className="lp-evidence">
            <EvRow label="Confidential mint with CT extension" addr={CT_EVIDENCE.mint} live={ev.checked ? ev.mintLive : null} />
            <EvRow label="Configured confidential token account" addr={CT_EVIDENCE.tokenAccount} live={ev.checked ? ev.accountLive : null} />
            <EvRow label="Equality proof context" addr={CT_EVIDENCE.equalityProofContext} live={ev.checked ? ev.proofContextsLive >= 1 : null} />
            <EvRow label="Validity proof context (3 handles)" addr={CT_EVIDENCE.validityProofContext} live={ev.checked ? ev.proofContextsLive >= 2 : null} />
            <EvRow label="Range proof context (128 bit)" addr={CT_EVIDENCE.rangeProofContext} live={ev.checked ? ev.proofContextsLive >= 3 : null} />
            <EvRow label="Encrypted deposit, applied on chain" tx={CT_EVIDENCE.depositTx} live={null} />
          </div>
          <p className="lp-copy lp-fine">
            Proof contexts live on the native proof program <code>{short(ZK_PROOF_PROGRAM, 12, 4)}</code>. The final
            pipeline step, the confidential transfer itself, is gated — see below.
          </p>
        </section>
      </Reveal>

      {/* capability boundary — the honest gate, isolated */}
      <Reveal as="section">
        <section className="lp-section" id="status">
          <span className="label">Capability status</span>
          <h2 className="lp-h2">What works today, and the one thing that is gated</h2>
          <div className="lp-status">
            <div className="lp-status__col">
              <span className="badge badge--live">working now</span>
              <ul>
                <li>Bonding curve quoting and trading arithmetic, byte exact with the program</li>
                <li>Merkle settlement building and local proof verification in the browser</li>
                <li>Fee split accounting with exact remainder assignment</li>
                <li>Live wallet, balance, and transaction reads from any Solana RPC</li>
                <li>Confidential setup pipeline, steps one through five, confirmed on Devnet</li>
                <li>Per program deployment probing — the app never assumes a program exists</li>
              </ul>
            </div>
            <div className="lp-status__col lp-status__col--gated">
              <span className="badge badge--held">gated, fail closed</span>
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
            </div>
          </div>
        </section>
      </Reveal>

      {/* programs */}
      <Reveal as="section">
        <section className="lp-section" id="programs">
          <span className="label">Architecture</span>
          <h2 className="lp-h2">Seven programs, one domain each</h2>
          <div className="lp-programs">
            {(Object.keys(PROGRAM_IDS) as ProgramKey[]).map((k) => (
              <a className="lp-program" key={k} href={explorerAddress(PROGRAM_IDS[k])} target="_blank" rel="noreferrer">
                <span className="lp-program__name">{PROGRAM_LABELS[k]}</span>
                <span className="lp-program__role">{PROGRAM_ROLES[k]}</span>
                <span className="address">{short(PROGRAM_IDS[k], 8, 6)}</span>
              </a>
            ))}
          </div>
          <p className="lp-copy lp-fine">
            Anchor programs with declared canonical IDs. The app probes each ID against the connected RPC and only
            enables write actions where a program is actually executable.
          </p>
        </section>
      </Reveal>

      {/* faq */}
      <Reveal as="section">
        <section className="lp-section" id="faq">
          <span className="label">FAQ</span>
          <h2 className="lp-h2">Direct answers</h2>
          <div className="lp-faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </Reveal>

      {/* final CTA */}
      <section className="lp-section lp-final">
        <h2 className="lp-h2">See it running against Devnet</h2>
        <p className="lp-copy">
          Browse launches, quote trades with the exact on chain arithmetic, verify a Merkle proof in your browser, and
          inspect the confidential transfer evidence live.
        </p>
        <Link className="button button--primary lp-cta" to="/launches">
          Open the app
        </Link>
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

/* ---------------------------------------------------------------- pieces */

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
    <div className="lp-hero__panel" role="img" aria-label="Live protocol status readout">
      <div className="lp-hero__panel-row">
        <span className="label">Devnet RPC</span>
        <span className="tabular" data-tone={connected ? "on" : "off"}>
          {connected ? `connected · slot ${slot?.toLocaleString() ?? "…"}` : checked ? "unreachable" : "connecting…"}
        </span>
      </div>
      <div className="lp-hero__panel-row">
        <span className="label">Confidential setup evidence</span>
        <span className="tabular" data-tone={evidenceLive ? "on" : undefined}>
          {!checked ? "re verifying…" : evidenceLive ? "5 / 5 artifacts live on chain" : "partially verified"}
        </span>
      </div>
      <div className="lp-hero__panel-row">
        <span className="label">Private transfer execution</span>
        <span className="tabular" data-tone="warn">
          fail closed · upstream zk ops disabled
        </span>
      </div>
      <div className="lp-hero__panel-row">
        <span className="label">Fallback ledger</span>
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
      <span>{label}</span>
      <span className="address">{short(display, 10, 6)}</span>
      <span className="lp-evrow__live">
        {live === null ? (
          <span className="muted fine">explorer ↗</span>
        ) : live ? (
          <span className="gain fine">live on chain</span>
        ) : (
          <span className="loss fine">not found</span>
        )}
      </span>
    </a>
  );
}
