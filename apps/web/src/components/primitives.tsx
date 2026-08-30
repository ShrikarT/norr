import type { ReactNode } from "react";
import { explorerAddress, explorerTx, short } from "../lib/config";
import type { TxState } from "../lib/tx";

export function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || aside) && (
        <div className="panel__head">
          {typeof title === "string" ? <span className="label">{title}</span> : title}
          {aside}
        </div>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}

export function Badge({ kind, children }: { kind: "live" | "held" | "sealed" | "settled" | "gain" | "loss"; children: ReactNode }) {
  return <span className={`badge badge--${kind}`}>{children}</span>;
}

export function Metric({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="metric__value truncate">{value}</div>
      {note !== undefined && <div className="metric__note truncate">{note}</div>}
    </div>
  );
}

export function Callout({ tone = "note", children }: { tone?: "note" | "info" | "risk"; children: ReactNode }) {
  const cls = tone === "info" ? "callout callout--violet" : tone === "risk" ? "callout callout--risk" : "callout";
  return <div className={cls}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function AddressLink({ address, chars = 5 }: { address: string; chars?: number }) {
  return (
    <a className="address addr-link" href={explorerAddress(address)} target="_blank" rel="noreferrer" title={address}>
      {short(address, chars, 4)}
    </a>
  );
}

export function TxLink({ signature }: { signature: string }) {
  return (
    <a className="address addr-link" href={explorerTx(signature)} target="_blank" rel="noreferrer" title={signature}>
      {short(signature, 8, 8)}
    </a>
  );
}

const STAGE_COPY: Record<TxState["stage"], string> = {
  idle: "",
  simulating: "Simulating against the cluster…",
  "awaiting-signature": "Waiting for your wallet signature…",
  sent: "Sent. Waiting for confirmation…",
  confirmed: "Confirmed on-chain.",
  failed: "Failed.",
  rejected: "Signature rejected in wallet.",
};

/** Inline transaction lifecycle readout. Renders nothing while idle. */
export function TxStatus({ state }: { state: TxState }) {
  if (state.stage === "idle") return null;
  const tone = state.stage === "confirmed" ? "done" : state.stage === "failed" || state.stage === "rejected" ? "blocked" : "pending";
  return (
    <div className="tx-status" data-tone={tone} aria-live="polite">
      <span className="tx-status__stage">{state.stage.replace("-", " ")}</span>
      <span className="tx-status__copy">
        {STAGE_COPY[state.stage]}
        {state.computeUnits !== null && state.stage !== "failed" && ` ${state.computeUnits.toLocaleString()} CU.`}
      </span>
      {state.error && <span className="tx-status__error">{state.error}</span>}
      {state.signature && <TxLink signature={state.signature} />}
    </div>
  );
}

export function StatusDot({ on, warn = false }: { on: boolean; warn?: boolean }) {
  return <i className="status-dot" data-state={on ? "on" : warn ? "warn" : "off"} aria-hidden="true" />;
}

export function PageHead({
  kicker,
  title,
  copy,
  action,
}: {
  kicker?: string;
  title: ReactNode;
  copy?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {kicker && <span className="label">{kicker}</span>}
        <h1 className="lead" style={kicker ? { marginTop: 10 } : undefined}>
          {title}
        </h1>
        {copy && <p>{copy}</p>}
      </div>
      {action}
    </div>
  );
}

/** A deliberate, labeled gate for functionality that depends on an on-chain
 *  capability which is absent on the connected cluster. Never fakes success. */
export function CapabilityGate({ title, reason, children }: { title: string; reason: ReactNode; children?: ReactNode }) {
  return (
    <div className="gate">
      <div className="gate__head">
        <span className="label">{title}</span>
        <Badge kind="held">unavailable on this cluster</Badge>
      </div>
      <p className="gate__reason">{reason}</p>
      {children}
    </div>
  );
}
