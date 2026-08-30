import { useState } from "react";
import { useCluster } from "../lib/status";
import { PROGRAM_IDS, PROGRAM_LABELS, getRpcUrl, setRpcUrl, type ProgramKey } from "../lib/config";
import { AddressLink, Badge, PageHead, Panel } from "../components/primitives";

export function Settings() {
  const c = useCluster();
  const [rpcDraft, setRpcDraft] = useState(getRpcUrl());
  const [density, setDensity] = useState(document.documentElement.dataset.density ?? "comfortable");
  const rpcChanged = rpcDraft !== c.rpcUrl;
  const rpcValid = /^https?:\/\/.+/.test(rpcDraft);

  const applyRpc = () => {
    if (!rpcValid) return;
    setRpcUrl(rpcDraft === "https://api.devnet.solana.com" ? null : rpcDraft);
    location.reload();
  };

  return (
    <>
      <PageHead title="Settings" copy="Network verification, program deployment status, and display preferences." />
      <div className="stack">
        <Panel title="Network" aside={<Badge kind={c.connected ? "settled" : "loss"}>{c.connected ? "connected" : "unreachable"}</Badge>}>
          <div className="stack">
            <label className="field">
              <span className="label">RPC endpoint</span>
              <input value={rpcDraft} onChange={(e) => setRpcDraft(e.target.value.trim())} spellCheck={false} />
              {!rpcValid && <span className="field__help loss">Must be an http(s) URL.</span>}
            </label>
            <div className="inline">
              <button className="button" disabled={!rpcChanged || !rpcValid} onClick={applyRpc}>
                Apply and reconnect
              </button>
              {rpcDraft !== "https://api.devnet.solana.com" && (
                <button
                  className="button button--ghost"
                  onClick={() => {
                    setRpcUrl(null);
                    location.reload();
                  }}
                >
                  Reset to devnet default
                </button>
              )}
            </div>
            <div className="grid grid--2">
              <div className="field">
                <span className="label">Genesis hash (read live)</span>
                <span className="address">{c.genesisHash ?? "unavailable"}</span>
              </div>
              <div className="field">
                <span className="label">Cluster identity</span>
                <span>
                  {c.identity}
                  {c.identity === "devnet" && <span className="gain fine"> · verified by genesis hash</span>}
                  {c.identity === "unknown" && c.connected && <span className="loss fine"> · unrecognized genesis</span>}
                </span>
              </div>
              <div className="field">
                <span className="label">Slot / epoch</span>
                <span className="tabular">
                  {c.slot?.toLocaleString() ?? "—"} / {c.epoch ?? "—"}
                </span>
              </div>
              <div className="field">
                <span className="label">History indexer</span>
                <span>{c.indexer}</span>
              </div>
            </div>
            {c.rpcError && <div className="callout callout--risk">{c.rpcError}</div>}
          </div>
        </Panel>

        <Panel
          title="Program deployment"
          aside={
            <button className="button button--ghost" onClick={c.refresh} style={{ minHeight: 32 }}>
              Re-probe
            </button>
          }
        >
          <div className="stack">
            <p className="muted fine">
              Each program ID is checked against the connected RPC for an executable account. Nothing in this app
              assumes a program exists — write actions enable only when this probe passes.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Address</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(PROGRAM_IDS) as ProgramKey[]).map((key) => (
                    <tr key={key}>
                      <td>{PROGRAM_LABELS[key]}</td>
                      <td>
                        <AddressLink address={PROGRAM_IDS[key]} chars={8} />
                      </td>
                      <td>
                        {c.programsDeployed === null ? (
                          <span className="muted fine">probing…</span>
                        ) : c.programsDeployed[key] ? (
                          <span className="gain fine">executable</span>
                        ) : (
                          <span className="muted fine">not deployed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <Panel title="Display">
          <label className="field" style={{ maxWidth: 320 }}>
            <span className="label">Density</span>
            <select
              value={density}
              onChange={(e) => {
                setDensity(e.target.value);
                document.documentElement.dataset.density = e.target.value;
              }}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
        </Panel>
      </div>
    </>
  );
}
