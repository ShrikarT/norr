import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { quoteBuy } from "@norr/sdk";
import { useCluster } from "../lib/status";
import { PROGRAM_IDS, short } from "../lib/config";
import { Badge, Callout, CapabilityGate, Metric, PageHead, Panel } from "../components/primitives";

export function StartIndex() {
  const cards = [
    {
      to: "/start/instant",
      title: "Instant market",
      tag: "bonding curve",
      copy: "A fixed-supply project token trading on an autonomous USDC constant-product curve from the moment of activation.",
    },
    {
      to: "/start/raise",
      title: "Sealed raise",
      tag: "amount private",
      copy: "Contribution amounts stay encrypted while the raise is open, then settle through a deterministic public Merkle claim.",
    },
    {
      to: "/desks",
      title: "Open a desk",
      tag: "curation",
      copy: "Publish curator terms and earn the locked minimum share on every raise that attaches to your desk.",
    },
  ];
  return (
    <>
      <PageHead
        kicker="§ launch / model"
        title={
          <>
            Choose the <em>model</em>
          </>
        }
        copy="Both models share the same settlement, fee routing, and social layers. They differ in one thing: whether contribution amounts are public while the launch is open."
      />
      <div className="grid grid--3">
        {cards.map((c) => (
          <Link className="launch-card" to={c.to} key={c.to}>
            <Badge kind="sealed">{c.tag}</Badge>
            <h2>{c.title}</h2>
            <p>{c.copy}</p>
            <span className="accent-text label">Continue →</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export function CreateLaunch() {
  const { mode: modeParam } = useParams();
  const mode: "instant" | "raise" = modeParam === "raise" ? "raise" : "instant";
  const wallet = useWallet();
  const c = useCluster();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [virtualBase, setVirtualBase] = useState("30000");
  const [creatorBps, setCreatorBps] = useState(7000);
  const [deskBps, setDeskBps] = useState(1500);

  const launchLive = c.programsDeployed?.launch === true;
  const treasuryBps = Math.max(0, 10_000 - creatorBps - deskBps);
  const splitsValid = creatorBps + deskBps <= 10_000 && creatorBps >= 0 && deskBps >= 0;
  const nameValid = name.trim().length >= 3 && name.trim().length <= 48;
  const symbolValid = /^[A-Z0-9]{2,10}$/.test(symbol);
  const supplyValid = /^\d{1,15}$/.test(supply) && BigInt(supply || "0") > 0n;

  const preview = useMemo(() => {
    try {
      const vb = BigInt(Math.floor(Number(virtualBase) * 1e6));
      const tr = BigInt(supply) * 1_000_000_000n;
      if (vb <= 0n || tr <= 0n) return null;
      const q = quoteBuy({ virtualBase: vb, baseReserve: 0n, tokenReserve: tr, baseIn: 1_000_000n, feeBps: 100 });
      return (Number(q.tokensOut) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 });
    } catch {
      return null;
    }
  }, [virtualBase, supply]);

  return (
    <>
      <PageHead
        kicker={mode === "instant" ? "§ launch / instant market" : "§ launch / sealed raise"}
        title={mode === "instant" ? "Configure an instant launch" : "Configure a sealed raise"}
        copy="Parameters are validated locally with the exact program arithmetic. Nothing is submitted until every constraint passes and you sign."
      />
      {mode === "raise" && (
        <Callout tone="risk">
          Sealed raises depend on Token-2022 confidential transfers, which are currently disabled in the canonical
          program on public clusters. A raise configured today cannot open for private contributions —{" "}
          <Link to="/private" className="accent-text">
            details
          </Link>
          .
        </Callout>
      )}
      <div className="grid grid--2" style={{ marginTop: 16 }}>
        <Panel title="Launch parameters">
          <div className="stack">
            <label className="field">
              <span className="label">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="3 to 48 characters" maxLength={48} />
              {!nameValid && name.length > 0 && <span className="field__help loss">Name must be 3 to 48 characters.</span>}
            </label>
            <label className="field">
              <span className="label">Symbol</span>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="2 to 10 characters, A–Z 0–9"
                maxLength={10}
              />
              {!symbolValid && symbol.length > 0 && <span className="field__help loss">Uppercase letters and digits only.</span>}
            </label>
            <label className="field">
              <span className="label">Fixed supply (whole tokens)</span>
              <input value={supply} onChange={(e) => setSupply(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" />
            </label>
            {mode === "instant" && (
              <label className="field">
                <span className="label">Virtual base (USDC)</span>
                <input value={virtualBase} onChange={(e) => setVirtualBase(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" />
                <span className="field__help">Sets the opening price. {preview && `1 USDC buys ≈ ${preview} tokens at open.`}</span>
              </label>
            )}
          </div>
        </Panel>
        <Panel title="Revenue split" aside={<Badge kind={splitsValid ? "settled" : "loss"}>{((creatorBps + deskBps + treasuryBps) / 100).toFixed(2)}%</Badge>}>
          <div className="stack">
            <label className="field">
              <span className="label">Creator share (bps)</span>
              <input type="number" min={0} max={10000} value={creatorBps} onChange={(e) => setCreatorBps(Number(e.target.value))} />
            </label>
            <label className="field">
              <span className="label">Desk share (bps)</span>
              <input type="number" min={0} max={10000} value={deskBps} onChange={(e) => setDeskBps(Number(e.target.value))} />
            </label>
            <div className="grid grid--2">
              <Metric label="Treasury remainder" value={`${treasuryBps} bps`} note={`${(treasuryBps / 100).toFixed(2)}%`} />
              <Metric label="Total" value="10,000 bps" note="must equal exactly 100%" />
            </div>
            <div className="allocation" aria-label="Split preview">
              <span style={{ width: `${creatorBps / 100}%` }} />
              <span style={{ width: `${deskBps / 100}%` }} />
              <span style={{ width: `${treasuryBps / 100}%` }} />
            </div>
          </div>
        </Panel>
      </div>
      <div className="stack" style={{ marginTop: 16 }}>
        {!launchLive ? (
          <CapabilityGate
            title="Submission"
            reason={
              <>
                norr-launch ({short(PROGRAM_IDS.launch)}) is not deployed on the connected cluster. Configuration and
                validation above are fully live; the create transaction enables automatically when the deployment
                probe finds the program executable.
              </>
            }
          />
        ) : !wallet.connected ? (
          <WalletMultiButton className="wallet-button" />
        ) : (
          <button className="button button--primary" disabled={!nameValid || !symbolValid || !supplyValid || !splitsValid}>
            Review and sign
          </button>
        )}
      </div>
    </>
  );
}
