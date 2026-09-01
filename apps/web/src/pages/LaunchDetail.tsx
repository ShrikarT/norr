import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { quoteBuy, quoteSell, priceQ64, buildMarketBuyInstruction, buildMarketSellInstruction, type Instruction } from "@norr/sdk";
import { useCluster } from "../lib/status";
import { useTx, toWeb3Instruction } from "../lib/tx";
import { useLaunch, type LiveCatalogLaunch } from "../lib/onchain";
import type { CatalogLaunch, CurveParams } from "../lib/catalog";
import { PROGRAM_IDS, TOKEN_2022_PROGRAM, DEVNET_USDC_MINT, short } from "../lib/config";
import { Badge, Callout, CapabilityGate, Empty, Metric, PageHead, Panel, TxStatus } from "../components/primitives";

const LEGACY_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

function ata(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), new PublicKey(LEGACY_TOKEN_PROGRAM).toBuffer(), mint.toBuffer()],
    new PublicKey(ATA_PROGRAM)
  )[0];
}

function createAtaIdempotentInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(LEGACY_TOKEN_PROGRAM), isSigner: false, isWritable: false },
    ],
    programId: new PublicKey(ATA_PROGRAM),
    data: Buffer.from([1]),
  });
}

function derivePda(program: string, seeds: Uint8Array[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds.map((s) => Buffer.from(s)), new PublicKey(program))[0];
}

export function LaunchDetail() {
  const { sale } = useParams();
  const { launch, loading } = useLaunch(sale);
  const [tab, setTab] = useState<"overview" | "discussion" | "settlement">("overview");

  if (loading && !launch)
    return (
      <>
        <PageHead title="Loading launch…" copy="Querying live Solana cluster for launch account state." />
        <Empty>Syncing on-chain state…</Empty>
      </>
    );

  if (!launch)
    return (
      <>
        <PageHead title="Launch not found" copy="No launch with this identifier exists in the catalog or on the connected cluster." />
        <Empty>
          <Link to="/launches" className="accent-text">
            Back to launches
          </Link>
        </Empty>
      </>
    );

  const price = launch.curve
    ? ((Number(priceQ64(launch.curve.virtualBase + launch.curve.baseReserve, launch.curve.tokenReserve)) / 2 ** 64) * 1e3).toFixed(6)
    : null;

  return (
    <>
      <PageHead
        kicker={launch.model === "instant" ? "§ launch / instant market" : "§ launch / sealed raise"}
        title={launch.name}
        copy={launch.description}
      />
      <div className="grid grid--metrics">
        <Metric label="Symbol" value={launch.symbol} note="9 decimals" />
        <Metric label="Opening price" value={price ? `${price} USDC` : "sealed while open"} note={launch.model === "instant" ? "constant product" : "amount private"} />
        <Metric label="Fixed supply" value={launch.supply} note="mint authority revoked at activation" />
        <Metric label="Trading fee" value={launch.curve ? `${launch.curve.feeBps / 100}%` : "—"} note="routed through split router" />
      </div>
      <div className="tabs">
        {(["overview", "discussion", "settlement"] as const).map((t) => (
          <button className="tab" key={t} aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="stack" style={{ marginTop: 16 }}>
        {tab === "overview" && (
          <>
            <div className="grid grid--2">
              {launch.model === "instant" && launch.curve ? <MarketPanel launch={launch} curve={launch.curve} /> : <ContributePanel />}
              <SplitPanel launch={launch} />
            </div>
            <PrivacyPanel />
          </>
        )}
        {tab === "discussion" && <DiscussionPanel />}
        {tab === "settlement" && <SettlementPanel launch={launch} />}
      </div>
    </>
  );
}

/** Bonding curve trade panel. Quotes use the exact integer arithmetic the
 *  program executes. The write path is gated on the market program actually
 *  being executable on the connected cluster — no fake sends. */
function MarketPanel({ launch, curve }: { launch: LiveCatalogLaunch; curve: CurveParams }) {
  const wallet = useWallet();
  const c = useCluster();
  const { state, run, reset } = useTx();
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("10");
  const [slippageBps, setSlippageBps] = useState(50);
  const [userUsdcBalance, setUserUsdcBalance] = useState<number | null>(null);
  const [userTokenBalance, setUserTokenBalance] = useState<number | null>(null);

  const marketLive = c.programsDeployed?.market === true;

  let projectMintKey: PublicKey;
  try {
    if (launch.projectMint) {
      projectMintKey = new PublicKey(launch.projectMint);
    } else if (launch.onchain?.projectMint) {
      projectMintKey = new PublicKey(launch.onchain.projectMint);
    } else if (launch.id.length >= 32 && launch.id.length <= 44 && !launch.id.includes("-")) {
      projectMintKey = new PublicKey(launch.id);
    } else {
      projectMintKey = derivePda(PROGRAM_IDS.launch, [Buffer.from("mock_mint"), Buffer.from(launch.id)]);
    }
  } catch {
    projectMintKey = derivePda(PROGRAM_IDS.launch, [Buffer.from("mock_mint"), Buffer.from(launch.id)]);
  }

  const baseMintStr = launch.curveAccount?.baseMint || launch.onchain?.contributionMint || DEVNET_USDC_MINT;
  const baseMint = new PublicKey(baseMintStr);

  useEffect(() => {
    if (!wallet.publicKey || !c.connection) {
      setUserUsdcBalance(null);
      setUserTokenBalance(null);
      return;
    }
    let active = true;
    const userBaseAta = ata(wallet.publicKey, baseMint);
    c.connection.getTokenAccountBalance(userBaseAta).then(
      (res) => {
        if (active) setUserUsdcBalance(res.value.uiAmount ?? 0);
      },
      () => {
        if (active) setUserUsdcBalance(0);
      }
    );

    if (projectMintKey) {
      const userTokenAta = ata(wallet.publicKey, projectMintKey);
      c.connection.getTokenAccountBalance(userTokenAta).then(
        (res) => {
          if (active) setUserTokenBalance(res.value.uiAmount ?? 0);
        },
        () => {
          if (active) setUserTokenBalance(0);
        }
      );
    }

    return () => {
      active = false;
    };
  }, [wallet.publicKey, baseMint, projectMintKey, c.connection, state.stage]);

  const quote = useMemo(() => {
    const num = Number.parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) return null;
    try {
      if (mode === "buy") {
        const baseIn = BigInt(Math.floor(num * 1e6));
        const q = quoteBuy({ ...curve, baseIn });
        return { out: Number(q.tokensOut) / 1e9, fee: Number(q.fee) / 1e6, outAtomic: q.tokensOut, inAtomic: baseIn, unit: launch.symbol };
      }
      const tokensIn = BigInt(Math.floor(num * 1e9));
      const q = quoteSell({ ...curve, tokensIn });
      return { out: Number(q.baseOut) / 1e6, fee: Number(q.fee) / 1e6, outAtomic: q.baseOut, inAtomic: tokensIn, unit: "USDC" };
    } catch {
      return null;
    }
  }, [amount, mode, curve, launch.symbol]);

  const handleTrade = async () => {
    if (!wallet.publicKey || !quote) return;
    reset();

    let curvePda: PublicKey;
    if (launch.curvePda) {
      curvePda = new PublicKey(launch.curvePda);
    } else if (launch.onchain?.curve) {
      curvePda = new PublicKey(launch.onchain.curve);
    } else {
      curvePda = derivePda(PROGRAM_IDS.market, [Buffer.from("curve"), projectMintKey.toBuffer()]);
    }

    const tokenVault = launch.curveAccount?.tokenVault
      ? new PublicKey(launch.curveAccount.tokenVault)
      : ata(curvePda, projectMintKey);
    const baseVault = launch.curveAccount?.baseVault
      ? new PublicKey(launch.curveAccount.baseVault)
      : ata(curvePda, baseMint);

    let router: PublicKey;
    if (launch.routerPda) {
      router = new PublicKey(launch.routerPda);
    } else if (launch.onchain?.router) {
      router = new PublicKey(launch.onchain.router);
    } else {
      const launchKey = launch.address ? new PublicKey(launch.address) : derivePda(PROGRAM_IDS.launch, [Buffer.from("launch"), projectMintKey.toBuffer()]);
      router = derivePda(PROGRAM_IDS.fees, [Buffer.from("router"), launchKey.toBuffer()]);
    }

    const routerVault = ata(router, baseMint);
    const userBaseToken = ata(wallet.publicKey, baseMint);
    const userProjectToken = ata(wallet.publicKey, projectMintKey);

    const accounts = {
      user: wallet.publicKey.toBase58(),
      curve: curvePda.toBase58(),
      userBaseToken: userBaseToken.toBase58(),
      userProjectToken: userProjectToken.toBase58(),
      baseVault: baseVault.toBase58(),
      tokenVault: tokenVault.toBase58(),
      routerVault: routerVault.toBase58(),
      router: router.toBase58(),
      tokenProgram: LEGACY_TOKEN_PROGRAM,
    };

    const instructions: TransactionInstruction[] = [
      createAtaIdempotentInstruction(wallet.publicKey, userBaseToken, wallet.publicKey, baseMint),
      createAtaIdempotentInstruction(wallet.publicKey, userProjectToken, wallet.publicKey, projectMintKey),
    ];

    const minOut = (quote.outAtomic * BigInt(10_000 - slippageBps)) / 10_000n;

    const ix: Instruction =
      mode === "buy"
        ? buildMarketBuyInstruction(PROGRAM_IDS.market, accounts, quote.inAtomic, minOut)
        : buildMarketSellInstruction(PROGRAM_IDS.market, accounts, quote.inAtomic, minOut);

    instructions.push(toWeb3Instruction(ix));

    console.log("=== NORR Trade Diagnostic ===", {
      mode,
      amount,
      slippageBps,
      launchAddress: launch.address,
      curvePda: curvePda.toBase58(),
      projectMint: projectMintKey.toBase58(),
      baseMint: baseMint.toBase58(),
      router: router.toBase58(),
      user: wallet.publicKey.toBase58(),
      userBaseToken: userBaseToken.toBase58(),
      userProjectToken: userProjectToken.toBase58(),
      instructionCount: instructions.length,
      quote,
      minOut: minOut.toString(),
    });

    await run(c.connection, wallet, instructions);
  };

  const parsedAmount = Number.parseFloat(amount);
  const isInsufficient =
    mode === "buy"
      ? userUsdcBalance !== null && parsedAmount > 0 && parsedAmount > userUsdcBalance
      : userTokenBalance !== null && parsedAmount > 0 && parsedAmount > userTokenBalance;

  return (
    <Panel title="Trade" aside={<Badge kind="sealed">bonding curve</Badge>}>
      <div className="stack">
        <div className="seg" aria-label="Trade direction">
          <button aria-pressed={mode === "buy"} onClick={() => { setMode("buy"); reset(); }}>
            Buy
          </button>
          <button aria-pressed={mode === "sell"} onClick={() => { setMode("sell"); reset(); }}>
            Sell
          </button>
        </div>
        <div className="grid grid--2">
          <label className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="label">Pay / {mode === "buy" ? "USDC" : launch.symbol}</span>
              {wallet.publicKey && (
                <span className="fine muted" style={{ fontSize: "0.75rem" }}>
                  Bal:{" "}
                  <strong className="accent-text">
                    {mode === "buy"
                      ? userUsdcBalance !== null
                        ? `${userUsdcBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
                        : "…"
                      : userTokenBalance !== null
                      ? `${userTokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${launch.symbol}`
                      : "…"}
                  </strong>
                </span>
              )}
            </div>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
          </label>
          <label className="field">
            <span className="label">Max slippage</span>
            <select value={slippageBps} onChange={(e) => setSlippageBps(Number(e.target.value))}>
              <option value={50}>0.50%</option>
              <option value={100}>1.00%</option>
              <option value={250}>2.50%</option>
            </select>
          </label>
        </div>
        <div className="quote-row">
          <div>
            <span className="label">Receive</span>
            <div className="tabular quote-row__value">
              {quote ? `${quote.out.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${quote.unit}` : "—"}
            </div>
          </div>
          <div>
            <span className="label">Fee ({curve.feeBps / 100}%)</span>
            <div className="tabular">{quote ? `${quote.fee.toFixed(4)} USDC` : "—"}</div>
          </div>
        </div>
        <p className="muted fine">
          Exact integer quote — the same ceiling-division arithmetic norr-market executes on-chain. Simulation runs
          before any signature is requested.
        </p>
        {!marketLive ? (
          <CapabilityGate
            title="Execution"
            reason={
              <>
                The norr-market program ({short(PROGRAM_IDS.market)}) is not deployed on the connected cluster. Quoting
                above is live; trade execution enables automatically when the deployment probe finds the program.
              </>
            }
          />
        ) : !wallet.connected ? (
          <WalletMultiButton className="wallet-button" />
        ) : isInsufficient ? (
          <div className="stack" style={{ gap: 8 }}>
            <button className="button button--primary" disabled={true}>
              Insufficient {mode === "buy" ? "USDC" : launch.symbol} Balance
            </button>
            <p className="fine" style={{ color: "var(--color-warn, #f59e0b)" }}>
              Your connected wallet has {mode === "buy" ? `${userUsdcBalance ?? 0} USDC` : `${userTokenBalance ?? 0} ${launch.symbol}`} (requires {amount} {mode === "buy" ? "USDC" : launch.symbol}).
            </p>
          </div>
        ) : (
          <button
            className="button button--primary"
            disabled={!quote || state.stage === "simulating" || state.stage === "awaiting-signature" || state.stage === "sent"}
            onClick={handleTrade}
          >
            {mode === "buy" ? `Buy ${launch.symbol}` : `Sell ${launch.symbol}`}
          </button>
        )}
        <TxStatus state={state} />
      </div>
    </Panel>
  );
}

function ContributePanel() {
  return (
    <Panel title="Sealed contribution" aside={<Badge kind="held">fail closed</Badge>}>
      <div className="stack">
        <p>
          Amounts stay confidential, not anonymous: your wallet, timing, and public deposits remain visible. Only the
          contribution size is encrypted.
        </p>
        <CapabilityGate
          title="Confidential transfer gate"
          reason={
            <>
              Token-2022 confidential transfer lifecycle (Steps 1–8) is confirmed on Solana Devnet. Private on-chain
              contribution paths remain fail closed under <code>P0Required</code> until external cryptographic review
              attestations are finalized. See live evidence and verification status on{" "}
              <Link to="/private" className="accent-text">
                Private
              </Link>
              .
            </>
          }
        />
      </div>
    </Panel>
  );
}

function SplitPanel({ launch }: { launch: CatalogLaunch }) {
  const total = launch.splits.reduce((n, s) => n + s.bps, 0);
  return (
    <Panel title="Revenue split" aside={<Badge kind={total === 10_000 ? "settled" : "loss"}>{(total / 100).toFixed(2)}%</Badge>}>
      <div className="stack">
        <div className="allocation" aria-label="Allocation bar">
          {launch.splits.map((s) => (
            <span key={s.name} style={{ width: `${s.bps / 100}%` }} title={`${s.name} ${s.bps / 100}%`} />
          ))}
        </div>
        {launch.splits.map((s) => (
          <div className="split-row" key={s.name}>
            <div className="field">
              <span className="label">{s.role}</span>
              <span>{s.name}</span>
            </div>
            <div className="field">
              <span className="label">bps</span>
              <span className="tabular">{s.bps}</span>
            </div>
          </div>
        ))}
        <p className="muted fine">
          Splits are locked at activation. The largest share receives each deposit's atomic-unit remainder; accrual
          never moves backward.
        </p>
      </div>
    </Panel>
  );
}

function PrivacyPanel() {
  return (
    <Panel title="Privacy boundary" aside={<Badge kind="sealed">by design</Badge>}>
      <div className="privacy-grid">
        <div>
          <span className="label">Hidden while open</span>
          <p>Contribution amounts and private workspace balances (Twisted ElGamal ciphertexts + ZK proofs).</p>
        </div>
        <div>
          <span className="label">Always visible</span>
          <p>Participants, timing, the account graph, public wrapping, and aggregate backing.</p>
        </div>
        <div>
          <span className="label">Custody</span>
          <p>The sale PDA. The operator can decrypt for tally but cannot redirect funds.</p>
        </div>
        <div>
          <span className="label">Exit</span>
          <p>A timelocked public-USDC refund if settlement misses its fixed deadline.</p>
        </div>
      </div>
    </Panel>
  );
}

function DiscussionPanel() {
  const c = useCluster();
  const socialLive = c.programsDeployed?.social === true;
  return (
    <Panel title="Signed discussion" aside={<Badge kind="sealed">norr-social</Badge>}>
      <div className="stack">
        <p className="muted">
          Threads and comments are program accounts on norr-social — every post is a signed transaction, every author a
          verified wallet.
        </p>
        {socialLive ? (
          <Empty>No thread account exists for this launch yet.</Empty>
        ) : (
          <CapabilityGate
            title="Posting"
            reason={
              <>
                norr-social ({short(PROGRAM_IDS.social)}) is not deployed on the connected cluster, so there are no
                thread accounts to read and nothing to post to. This panel activates automatically once the program is
                live.
              </>
            }
          />
        )}
      </div>
    </Panel>
  );
}

function SettlementPanel({ launch }: { launch: CatalogLaunch }) {
  const c = useCluster();
  const claimLive = c.programsDeployed?.claim === true;
  return (
    <div className="stack">
      <Panel title="Deterministic settlement" aside={<Badge kind="sealed">merkle · depth ≤ 20</Badge>}>
        <div className="stack">
          <p className="muted">
            After a sealed raise closes, allocations commit to a domain-separated Merkle root
            (<code>norr-claim-v1</code> leaves, keccak-256, depth capped at 20). Every claimant can verify their leaf
            locally before the claim-status account commits, and payment can only reach the claimant's canonical token
            account.
          </p>
          <div className="grid grid--2">
            <div className="field">
              <span className="label">Leaf domain</span>
              <span className="tabular">norr-claim-v1 · norr-refund-v1</span>
            </div>
            <div className="field">
              <span className="label">Refund escrow</span>
              <span className="tabular">timelocked · 7 day review</span>
            </div>
          </div>
        </div>
      </Panel>
      {!claimLive && (
        <CapabilityGate
          title="Claims"
          reason={
            <>
              norr-claim ({short(PROGRAM_IDS.claim)}) is not deployed on the connected cluster; {launch.symbol} has no
              sale account or committed root to claim against. The verifier below still runs the real Merkle
              arithmetic locally.
            </>
          }
        />
      )}
      <MerkleVerifier />
    </div>
  );
}

/** Local, real Merkle demonstration: builds a tree with @norr/sdk and verifies
 *  a proof in the browser. Nothing here claims to touch the chain. */
function MerkleVerifier() {
  const [claimant, setClaimant] = useState("");
  const [result, setResult] = useState<null | { root: string; ok: boolean; depth: number }>(null);
  const [error, setError] = useState<string | null>(null);

  const runVerification = async () => {
    setError(null);
    setResult(null);
    try {
      new PublicKey(claimant); // validates base58 + length
      const sdk = await import("@norr/sdk");
      const others = [
        "FWvsL5EBeQCSDHsTT5mmaohTGrdVZq88jY6uzASUKAfV",
        "48Fz4Shqtu9MZBXuAKc1rwm4wQsxcRdkzMtQiW7vdcm2",
        "4aou9742wef3vMVnZdSUs66G9GvDDJUrmvTHTKLBx2jk",
      ].filter((a) => a !== claimant);
      const leaves = [claimant, ...others].map((who, i) =>
        sdk.allocationLeaf({
          programId: PROGRAM_IDS.claim,
          sale: PROGRAM_IDS.launch,
          projectMint: TOKEN_2022_PROGRAM,
          claimant: who,
          allocation: BigInt((i + 1) * 1_000_000),
        })
      );
      const tree = new sdk.MerkleTree(leaves);
      const proof = tree.proof(0);
      const ok = sdk.verifyMerkleProof(leaves[0]!, proof, tree.root);
      const rootHex = Array.from(tree.root.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
      setResult({ root: rootHex, ok, depth: proof.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Panel title="Local proof check" aside={<Badge kind="sealed">runs in your browser</Badge>}>
      <div className="stack">
        <p className="muted fine">
          Builds a 4-leaf allocation tree with the production Merkle code (keccak-256, domain-separated leaves) and
          verifies your inclusion proof locally. This is the identical arithmetic norr-claim runs on-chain.
        </p>
        <label className="field">
          <span className="label">Claimant address</span>
          <input
            value={claimant}
            onChange={(e) => {
              setClaimant(e.target.value.trim());
              setResult(null);
              setError(null);
            }}
            placeholder="Any Solana public key"
            spellCheck={false}
          />
        </label>
        <div className="inline">
          <button className="button" disabled={!claimant} onClick={runVerification}>
            Build tree and verify proof
          </button>
          {result && (
            <span className={result.ok ? "gain fine" : "loss fine"}>
              {result.ok ? "proof verified" : "proof failed"} · root {result.root}… · depth {result.depth}
            </span>
          )}
        </div>
        {error && <span className="loss fine">{error}</span>}
      </div>
    </Panel>
  );
}
