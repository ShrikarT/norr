import { Link, useParams } from "react-router-dom";
import { useCluster } from "../lib/status";
import { SAMPLE_DESKS, SAMPLE_LAUNCHES } from "../lib/catalog";
import { PROGRAM_IDS, short } from "../lib/config";
import { Badge, Callout, CapabilityGate, Empty, Metric, PageHead, Panel } from "../components/primitives";
import { LaunchCard } from "./Launches";

export function Desks() {
  const c = useCluster();
  const boardsLive = c.programsDeployed?.boards === true;
  return (
    <>
      <PageHead
        title="Community desks"
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
        {!boardsLive && (
          <CapabilityGate
            title="Open a desk"
            reason="Desk creation submits create_board to norr-boards. It enables automatically when the program is executable on the connected cluster."
          />
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
        kicker={`desk / ${desk.slug}`}
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
