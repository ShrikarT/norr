import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { DISCRIMINATORS } from "@norr/sdk";
import { useCluster } from "../lib/status";
import { useTx } from "../lib/tx";
import { SAMPLE_DESKS, SAMPLE_LAUNCHES } from "../lib/catalog";
import { PROGRAM_IDS, short } from "../lib/config";
import { Badge, Callout, CapabilityGate, Empty, Metric, PageHead, Panel, TxStatus } from "../components/primitives";
import { LaunchCard } from "./Launches";

function u16le(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

function u32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

export function Desks() {
  const wallet = useWallet();
  const c = useCluster();
  const { state, run, reset } = useTx();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [minBps, setMinBps] = useState(250);
  const [allowlistOnly, setAllowlistOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const boardsLive = c.programsDeployed?.boards === true;
  const slugValid = /^[a-z0-9-]{3,32}$/.test(slug.trim());
  const nameValid = name.trim().length >= 3 && name.trim().length <= 48;
  const minBpsValid = minBps > 0 && minBps <= 5000;

  const handleCreateDesk = async () => {
    if (!wallet.publicKey || !slugValid || !nameValid || !minBpsValid) return;
    reset();
    const cleanSlug = slug.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanUri = `https://norr.io/desk/${cleanSlug}`;

    const [deskPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("board"), Buffer.from(cleanSlug, "utf8")],
      new PublicKey(PROGRAM_IDS.boards)
    );

    const slugBytes = Buffer.from(cleanSlug, "utf8");
    const nameBytes = Buffer.from(cleanName, "utf8");
    const uriBytes = Buffer.from(cleanUri, "utf8");

    const ix = new TransactionInstruction({
      programId: new PublicKey(PROGRAM_IDS.boards),
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: deskPda, isSigner: false, isWritable: true },
        { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        Buffer.from(DISCRIMINATORS.boards.create),
        u32le(slugBytes.length), slugBytes,
        u32le(nameBytes.length), nameBytes,
        u32le(uriBytes.length), uriBytes,
        u16le(minBps),
        Buffer.from([allowlistOnly ? 1 : 0]),
      ]),
    });

    await run(c.connection, wallet, [ix]);
  };

  return (
    <>
      <PageHead
        kicker="§ discover / desks"
        title={
          <>
            Community <em>desks</em>
          </>
        }
        copy="Curators publish an immutable slug and a minimum revenue share. When a launch attaches, the terms are snapshotted — the desk cannot raise its cut on existing raises."
      />
      {!boardsLive && c.programsDeployed && (
        <Callout tone="note">
          norr-boards ({short(PROGRAM_IDS.boards)}) is not deployed on the connected cluster; the desks below are
          reference terms, not live board accounts.
        </Callout>
      )}
      <div className="grid grid--2" style={{ marginTop: 16 }}>
        {SAMPLE_DESKS.map((b) => (
          <Link className="launch-card" to={`/desk/${b.slug}`} key={b.slug}>
            <div className="launch-card__top">
              <div>
                <h2>{b.name}</h2>
                <div className="address">/{b.slug}</div>
              </div>
              <Badge kind="sealed">{b.allowlistOnly ? "allowlist" : "open"}</Badge>
            </div>
            <p>{b.description}</p>
            <div className="grid grid--2">
              <Metric label="Minimum share" value={`${b.minBps / 100}%`} note="snapshot at attach" />
              <Metric label="Terms" value={b.allowlistOnly ? "curated" : "permissionless"} note="creator access" />
            </div>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        {!boardsLive ? (
          <CapabilityGate
            title="Open a desk"
            reason="Desk creation submits create_board to norr-boards. It enables automatically when the program is executable on the connected cluster."
          />
        ) : !showCreate ? (
          <button className="button button--secondary" onClick={() => setShowCreate(true)}>
            + Open a new curation desk
          </button>
        ) : (
          <Panel title="Configure curation desk" aside={<button className="button button--ghost" onClick={() => setShowCreate(false)}>Cancel</button>}>
            <div className="stack">
              <div className="grid grid--2">
                <label className="field">
                  <span className="label">Desk Slug (unique ID)</span>
                  <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="e.g. ai-agents, defi, infra" maxLength={32} />
                  {!slugValid && slug.length > 0 && <span className="field__help loss">3–32 lowercase alphanumeric and hyphens.</span>}
                </label>
                <label className="field">
                  <span className="label">Desk Name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" maxLength={48} />
                </label>
              </div>
              <div className="grid grid--2">
                <label className="field">
                  <span className="label">Minimum Share (bps)</span>
                  <input type="number" min={1} max={5000} value={minBps} onChange={(e) => setMinBps(Number(e.target.value))} />
                  <span className="field__help">{(minBps / 100).toFixed(2)}% fee share</span>
                </label>
                <label className="field" style={{ justifyContent: "center" }}>
                  <label className="inline" style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={allowlistOnly} onChange={(e) => setAllowlistOnly(e.target.checked)} />
                    <span>Curated allowlist only</span>
                  </label>
                </label>
              </div>
              {!wallet.connected ? (
                <WalletMultiButton className="wallet-button" />
              ) : (
                <button
                  className="button button--primary"
                  disabled={!slugValid || !nameValid || !minBpsValid || state.stage === "simulating" || state.stage === "awaiting-signature" || state.stage === "sent"}
                  onClick={handleCreateDesk}
                >
                  Create Desk on-chain
                </button>
              )}
              <TxStatus state={state} />
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}

export function DeskDetail() {
  const { slug } = useParams();
  const desk = SAMPLE_DESKS.find((d) => d.slug === slug);
  const c = useCluster();
  if (!desk)
    return (
      <>
        <PageHead title="Desk not found" copy="No desk with this slug exists in the catalog or on the connected cluster." />
        <Empty>
          <Link to="/desks" className="accent-text">
            Back to desks
          </Link>
        </Empty>
      </>
    );
  const attached = SAMPLE_LAUNCHES.filter((l) => l.desk === desk.slug);
  const boardsLive = c.programsDeployed?.boards === true;
  return (
    <>
      <PageHead
        kicker={`§ desk / ${desk.slug}`}
        title={desk.name}
        copy={`${desk.description} Minimum share ${desk.minBps / 100}% · ${desk.allowlistOnly ? "approved creators only" : "open to all creators"}.`}
      />
      <div className="stack">
        <Panel title="Attached launches" aside={<span className="muted fine">terms snapshotted at attach</span>}>
          {attached.length ? (
            <div className="grid grid--2">
              {attached.map((l) => (
                <LaunchCard launch={l} key={l.id} />
              ))}
            </div>
          ) : (
            <Empty>No launches attached to this desk.</Empty>
          )}
        </Panel>
        {!boardsLive && (
          <CapabilityGate
            title="Follow desk"
            reason="Following creates a marker account on norr-social. It enables when the programs are executable on the connected cluster."
          />
        )}
      </div>
    </>
  );
}

