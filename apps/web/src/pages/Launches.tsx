import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCluster } from "../lib/status";
import { SAMPLE_LAUNCHES, type CatalogLaunch } from "../lib/catalog";
import { priceQ64 } from "@norr/sdk";
import { Badge, Callout, Metric, PageHead } from "../components/primitives";

function curvePrice(launch: CatalogLaunch): string | null {
  if (!launch.curve) return null;
  const q = priceQ64(launch.curve.virtualBase + launch.curve.baseReserve, launch.curve.tokenReserve);
  // price = q64 / 2^64, base 6dp per token 9dp → *1e3 for USDC/token
  const value = (Number(q) / 2 ** 64) * 1e3;
  return value.toFixed(6);
}

export function Launches() {
  const navigate = useNavigate();
  const c = useCluster();
  const [model, setModel] = useState<"all" | "instant" | "raise">("all");
  const launches = SAMPLE_LAUNCHES.filter((l) => model === "all" || l.model === model);
  const programsLive = c.deployedCount > 0;

  return (
    <>
      <PageHead
        title={
          <>
            Private while open.
            <br />
            <span className="accent-text">Public when settled.</span>
          </>
        }
        copy="Token launches on Solana where contribution amounts stay encrypted while a raise is open, then settle into public bonding curve markets with deterministic Merkle claims."
        action={
          <button className="button button--primary" onClick={() => navigate("/start")}>
            Start a launch
          </button>
        }
      />

      <div className="grid grid--metrics">
        <Metric label="Cluster" value={c.identity === "unknown" ? "—" : c.identity} note={c.genesisHash ? `genesis ${c.genesisHash.slice(0, 8)}…` : "verifying"} />
        <Metric label="RPC" value={c.connected ? "connected" : "unreachable"} note={c.slot ? `slot ${c.slot.toLocaleString()}` : c.rpcError ?? ""} />
        <Metric
          label="Programs on cluster"
          value={c.programsDeployed ? `${c.deployedCount} / 7` : "probing…"}
          note={programsLive ? "executable" : "not yet deployed"}
        />
        <Metric
          label="Confidential path"
          value={c.ctEvidence.checked ? (c.ctEvidence.mintLive ? "setup proven" : "unverified") : "checking…"}
          note="transfer gated upstream"
        />
      </div>

      {!programsLive && c.programsDeployed && (
        <Callout tone="note">
          The norr programs are not deployed on the connected cluster yet, so the launches below are reference
          parameters — exact curve math, real split rules, no live accounts. The deployment probe on{" "}
          <Link to="/settings" className="accent-text">
            Settings
          </Link>{" "}
          re-checks every program ID against RPC.
        </Callout>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel__head">
          <div className="seg" aria-label="Filter model">
            <button aria-pressed={model === "all"} onClick={() => setModel("all")}>
              All
            </button>
            <button aria-pressed={model === "instant"} onClick={() => setModel("instant")}>
              Instant
            </button>
            <button aria-pressed={model === "raise"} onClick={() => setModel("raise")}>
              Sealed
            </button>
          </div>
          <span className="muted fine">{launches.length} reference launch{launches.length === 1 ? "" : "es"}</span>
        </div>
        <div className="panel__body">
          <div className="grid grid--2">
            {launches.map((launch) => (
              <LaunchCard launch={launch} key={launch.id} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function LaunchCard({ launch }: { launch: CatalogLaunch }) {
  const price = curvePrice(launch);
  return (
    <Link to={`/raise/${launch.id}`} className="launch-card">
      <div className="launch-card__top">
        <div className="launch-card__id">
          <div className="mark-box">{launch.symbol.slice(0, 4)}</div>
          <div className="truncate">
            <h3 className="truncate">{launch.name}</h3>
            <p className="truncate">
              {launch.symbol} · {launch.model === "instant" ? "public curve" : "sealed raise"}
            </p>
          </div>
        </div>
        <Badge kind={launch.model === "raise" ? "sealed" : "held"}>{launch.state === "draft" ? "reference" : launch.state}</Badge>
      </div>
      <p>{launch.description}</p>
      <div className="launch-card__metrics">
        <div>
          <span className="label">Opening price</span>
          <div className="tabular">{price ? `${price} USDC` : "sealed while open"}</div>
        </div>
        <div>
          <span className="label">Supply</span>
          <div className="tabular">{launch.supply}</div>
        </div>
        <div>
          <span className="label">Desk</span>
          <div>{launch.desk ?? "independent"}</div>
        </div>
      </div>
    </Link>
  );
}
