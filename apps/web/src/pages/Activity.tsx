import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { ConfirmedSignatureInfo } from "@solana/web3.js";
import { useCluster } from "../lib/status";
import { Badge, Empty, PageHead, Panel, TxLink } from "../components/primitives";

export function Activity() {
  const wallet = useWallet();
  const c = useCluster();
  const [sigs, setSigs] = useState<readonly ConfirmedSignatureInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet.publicKey) {
      setSigs(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    c.connection
      .getSignaturesForAddress(wallet.publicKey, { limit: 25 })
      .then((result) => {
        if (active) setSigs(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to read signatures");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wallet.publicKey, c.connection]);

  return (
    <>
      <PageHead
        kicker="§ account / activity"
        title={
          <>
            On-chain <em>activity</em>
          </>
        }
        copy="The connected wallet's most recent transactions, read live from the cluster. The optional indexer adds protocol-decoded history when configured; it never decides state."
      />
      {!wallet.connected ? (
        <Panel title="Wallet">
          <div className="stack" style={{ alignItems: "start" }}>
            <p className="muted">Connect a wallet to read its transaction history.</p>
            <WalletMultiButton className="wallet-button" />
          </div>
        </Panel>
      ) : (
        <Panel
          title="Recent transactions"
          aside={<Badge kind={c.indexer === "online" ? "settled" : "sealed"}>{c.indexer === "online" ? "indexer online" : "rpc direct"}</Badge>}
        >
          {error ? (
            <div className="callout callout--risk">{error}</div>
          ) : loading && sigs === null ? (
            <Empty>Reading signatures…</Empty>
          ) : !sigs || sigs.length === 0 ? (
            <Empty>No transactions found for this wallet on the connected cluster.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Signature</th>
                    <th>Slot</th>
                    <th>Age</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sigs.map((s) => (
                    <tr key={s.signature}>
                      <td>
                        <TxLink signature={s.signature} />
                      </td>
                      <td className="tabular">{s.slot.toLocaleString()}</td>
                      <td className="tabular">{s.blockTime ? timeAgo(s.blockTime) : "—"}</td>
                      <td>{s.err ? <span className="loss">failed</span> : <span className="gain">success</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

function timeAgo(unixSeconds: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
