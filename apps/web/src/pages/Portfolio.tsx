import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useCluster } from "../lib/status";
import { TOKEN_2022_PROGRAM, short } from "../lib/config";
import { AddressLink, Badge, Empty, Metric, PageHead, Panel } from "../components/primitives";

const LEGACY_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

type TokenRow = Readonly<{ mint: string; amount: string; decimals: number; program: "token" | "token-2022" }>;

export function Portfolio() {
  const wallet = useWallet();
  const c = useCluster();
  const [balance, setBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<readonly TokenRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet.publicKey) {
      setBalance(null);
      setTokens(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const owner = wallet.publicKey as PublicKey;
        const [lamports, legacy, t22] = await Promise.all([
          c.connection.getBalance(owner),
          c.connection.getParsedTokenAccountsByOwner(owner, { programId: new PublicKey(LEGACY_TOKEN_PROGRAM) }),
          c.connection.getParsedTokenAccountsByOwner(owner, { programId: new PublicKey(TOKEN_2022_PROGRAM) }),
        ]);
        if (!active) return;
        setBalance(lamports / LAMPORTS_PER_SOL);
        const rows: TokenRow[] = [];
        for (const { account } of legacy.value) {
          const info = account.data.parsed.info;
          rows.push({ mint: info.mint, amount: info.tokenAmount.uiAmountString ?? "0", decimals: info.tokenAmount.decimals, program: "token" });
        }
        for (const { account } of t22.value) {
          const info = account.data.parsed.info;
          rows.push({ mint: info.mint, amount: info.tokenAmount.uiAmountString ?? "0", decimals: info.tokenAmount.decimals, program: "token-2022" });
        }
        setTokens(rows);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to read accounts");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet.publicKey, c.connection]);

  return (
    <>
      <PageHead
        kicker="§ account / holdings"
        title={
          <>
            Your <em>portfolio</em>
          </>
        }
        copy="Everything on this page is read directly from the connected RPC — SOL balance and every SPL Token and Token-2022 account the wallet owns."
      />
      {!wallet.connected ? (
        <Panel title="Wallet">
          <div className="stack" style={{ alignItems: "start" }}>
            <p className="muted">Connect a Solana wallet to read its accounts on {c.identity === "unknown" ? "the connected cluster" : c.identity}.</p>
            <WalletMultiButton className="wallet-button" />
          </div>
        </Panel>
      ) : (
        <div className="stack">
          <div className="grid grid--metrics">
            <Metric label="Address" value={short(wallet.publicKey!.toBase58(), 6, 6)} note={c.identity} />
            <Metric label="SOL" value={balance !== null ? balance.toFixed(4) : loading ? "reading…" : "—"} note="native balance" />
            <Metric label="Token accounts" value={tokens ? String(tokens.length) : loading ? "reading…" : "—"} note="SPL + Token-2022" />
            <Metric label="Commitment" value="confirmed" note={c.slot ? `slot ${c.slot.toLocaleString()}` : ""} />
          </div>
          <Panel title="Token accounts" aside={<Badge kind="sealed">live rpc read</Badge>}>
            {error ? (
              <div className="callout callout--risk">{error}</div>
            ) : tokens === null ? (
              <Empty>Reading token accounts…</Empty>
            ) : tokens.length === 0 ? (
              <Empty>
                This wallet holds no token accounts on {c.identity === "unknown" ? "this cluster" : c.identity}. Airdrop
                some Devnet SOL and acquire a test token to see balances here.
              </Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mint</th>
                      <th>Program</th>
                      <th>Decimals</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((t) => (
                      <tr key={t.mint + t.program}>
                        <td>
                          <AddressLink address={t.mint} chars={8} />
                        </td>
                        <td>{t.program}</td>
                        <td className="tabular">{t.decimals}</td>
                        <td className="tabular">{t.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
