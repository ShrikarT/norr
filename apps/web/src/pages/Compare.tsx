import { Link } from "react-router-dom";
import { priceQ64 } from "@norr/sdk";
import { SAMPLE_LAUNCHES } from "../lib/catalog";
import { useCluster } from "../lib/status";
import { Callout, PageHead, Panel } from "../components/primitives";

export function Compare() {
  const c = useCluster();
  return (
    <>
      <PageHead
        title="Compare launches"
        copy="Launch parameters side by side: model, curve configuration, opening price from the exact Q64 arithmetic, and split totals."
      />
      {c.programsDeployed && c.deployedCount === 0 && (
        <Callout tone="note">Reference parameters — the programs are not yet deployed on the connected cluster.</Callout>
      )}
      <Panel className="panel--table">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Launch</th>
                <th>Model</th>
                <th>Supply</th>
                <th>Opening price</th>
                <th>Fee</th>
                <th>Creator share</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_LAUNCHES.map((l) => {
                const price = l.curve
                  ? ((Number(priceQ64(l.curve.virtualBase + l.curve.baseReserve, l.curve.tokenReserve)) / 2 ** 64) * 1e3).toFixed(6)
                  : null;
                const creator = l.splits.find((s) => s.role === "creator");
                return (
                  <tr key={l.id}>
                    <td>
                      <Link to={`/raise/${l.id}`} className="accent-text">
                        <b>{l.name}</b>
                      </Link>{" "}
                      <span className="muted">({l.symbol})</span>
                    </td>
                    <td>{l.model === "instant" ? "instant" : "sealed"}</td>
                    <td className="tabular">{l.supply}</td>
                    <td className="tabular">{price ? `${price} USDC` : "sealed"}</td>
                    <td className="tabular">{l.curve ? `${l.curve.feeBps / 100}%` : "—"}</td>
                    <td className="tabular">{creator ? `${creator.bps / 100}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
