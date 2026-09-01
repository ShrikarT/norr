import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { quoteBuy, DISCRIMINATORS, buildMarketInitializeInstruction, buildMarketActivateInstruction, type OnchainLaunch } from "@norr/sdk";
import { useCluster } from "../lib/status";
import { useTx, toWeb3Instruction } from "../lib/tx";
import { cacheCreatedLaunch } from "../lib/onchain";
import { PROGRAM_IDS, DEVNET_USDC_MINT, short } from "../lib/config";
import { Badge, Callout, CapabilityGate, Metric, PageHead, Panel, TxStatus } from "../components/primitives";

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

function u32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

export function CreateLaunch() {
  const { mode: modeParam } = useParams();
  const mode: "instant" | "raise" = modeParam === "raise" ? "raise" : "instant";
  const navigate = useNavigate();
  const wallet = useWallet();
  const c = useCluster();
  const { state, run, reset } = useTx();
  const [createdLaunchAddress, setCreatedLaunchAddress] = useState<string | null>(null);
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

  const handleCreate = async () => {
    if (!wallet.publicKey) return;
    reset();
    const projectMintKeypair = Keypair.generate();
    const [launchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("launch"), projectMintKeypair.publicKey.toBuffer()],
      new PublicKey(PROGRAM_IDS.launch)
    );
    const [salePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("sale"), launchPda.toBuffer()],
      new PublicKey(PROGRAM_IDS.claim)
    );
    const [routerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("router"), launchPda.toBuffer()],
      new PublicKey(PROGRAM_IDS.fees)
    );
    const [curvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("curve"), projectMintKeypair.publicKey.toBuffer()],
      new PublicKey(PROGRAM_IDS.market)
    );

    const nameBytes = Buffer.from(name.trim(), "utf8");
    const symBytes = Buffer.from(symbol.trim(), "utf8");
    const uriBytes = Buffer.from("https://norr.io/token.json", "utf8");

    const ix = new TransactionInstruction({
      programId: new PublicKey(PROGRAM_IDS.launch),
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: launchPda, isSigner: false, isWritable: true },
        { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        Buffer.from(DISCRIMINATORS.launch.create),
        projectMintKeypair.publicKey.toBuffer(),
        wallet.publicKey.toBuffer(),
        salePda.toBuffer(),
        routerPda.toBuffer(),
        curvePda.toBuffer(),
        Buffer.from([mode === "instant" ? 0 : 1]),
        Buffer.alloc(32),
        u32le(nameBytes.length), nameBytes,
        u32le(symBytes.length), symBytes,
        u32le(uriBytes.length), uriBytes,
      ]),
    });

    const instructions: TransactionInstruction[] = [ix];

    if (mode === "instant") {
      const baseMint = new PublicKey(DEVNET_USDC_MINT);
      const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
      const LEGACY_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
      const tokenVault = PublicKey.findProgramAddressSync(
        [curvePda.toBuffer(), new PublicKey(LEGACY_TOKEN_PROGRAM).toBuffer(), projectMintKeypair.publicKey.toBuffer()],
        new PublicKey(ATA_PROGRAM)
      )[0];
      const baseVault = PublicKey.findProgramAddressSync(
        [curvePda.toBuffer(), new PublicKey(LEGACY_TOKEN_PROGRAM).toBuffer(), baseMint.toBuffer()],
        new PublicKey(ATA_PROGRAM)
      )[0];

      const vb = BigInt(Math.floor(Number(virtualBase || "30000") * 1e6));
      const tr = BigInt(supply || "1000000000") * 1_000_000_000n;

      const marketInitIx = buildMarketInitializeInstruction(
        PROGRAM_IDS.market,
        {
          payer: wallet.publicKey.toBase58(),
          launch: launchPda.toBase58(),
          curve: curvePda.toBase58(),
        },
        {
          projectMint: projectMintKeypair.publicKey.toBase58(),
          baseMint: baseMint.toBase58(),
          tokenVault: tokenVault.toBase58(),
          baseVault: baseVault.toBase58(),
          router: routerPda.toBase58(),
          liquidityBeneficiary: wallet.publicKey.toBase58(),
          virtualBase: vb > 0n ? vb : 30_000_000_000n,
          tokenReserve: tr > 0n ? tr : 1_000_000_000_000_000_000n,
          graduationTarget: 100_000_000_000n,
          feeBps: 100,
          maxBuyFirstSlots: 100n,
          liquidityUnlockAt: BigInt(Math.floor(Date.now() / 1000) + 15_552_000),
        }
      );

      const marketActivateIx = buildMarketActivateInstruction(
        PROGRAM_IDS.market,
        { curve: curvePda.toBase58() }
      );

      instructions.push(toWeb3Instruction(marketInitIx), toWeb3Instruction(marketActivateIx));
    }

    const sig = await run(c.connection, wallet, instructions);
    if (sig) {
      const newLaunch: OnchainLaunch = {
        address: launchPda.toBase58(),
        creator: wallet.publicKey.toBase58(),
        board: "11111111111111111111111111111111",
        projectMint: projectMintKeypair.publicKey.toBase58(),
        contributionMint: wallet.publicKey.toBase58(),
        sale: salePda.toBase58(),
        router: routerPda.toBase58(),
        curve: curvePda.toBase58(),
        model: mode,
        createdAt: Math.floor(Date.now() / 1000),
        flags: 0,
        metadataHash: new Uint8Array(32),
        name: name.trim(),
        symbol: symbol.trim(),
        uri: "https://norr.io/token.json",
        bump: 255,
      };
      cacheCreatedLaunch(newLaunch);
      setCreatedLaunchAddress(launchPda.toBase58());
    }
  };

  return (
    <>
      <PageHead
        kicker={mode === "instant" ? "§ launch / instant market" : "§ launch / sealed raise"}
        title={mode === "instant" ? "Configure an instant launch" : "Configure a sealed raise"}
        copy="Parameters are validated locally with the exact program arithmetic. Nothing is submitted until every constraint passes and you sign."
      />
      {mode === "raise" && (
        <Callout tone="note">
          Sealed raises utilize Token-2022 confidential transfers (verified on Devnet). Private value movements
          remain fail-closed under <code>P0Required</code> until external security review attestations are finalized —{" "}
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
          <button
            className="button button--primary"
            disabled={!nameValid || !symbolValid || !supplyValid || !splitsValid || state.stage === "simulating" || state.stage === "awaiting-signature" || state.stage === "sent"}
            onClick={handleCreate}
          >
            Review and sign
          </button>
        )}
        <TxStatus state={state} />
        {createdLaunchAddress && state.stage === "confirmed" && (
          <div style={{ marginTop: 12 }}>
            <button
              className="button button--secondary"
              onClick={() => navigate(`/raise/${createdLaunchAddress}`)}
            >
              View Live Launch on-chain ({createdLaunchAddress.slice(0, 6)}…{createdLaunchAddress.slice(-4)}) →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
