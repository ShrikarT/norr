import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useCluster } from "../lib/status";
import { useToasts } from "./toast-context";
import { explorerTx } from "../lib/config";
import { StatusDot } from "./primitives";

export function Logo() {
  return (
    <Link to="/" className="wordmark" aria-label="Norr home">
      NORR
    </Link>
  );
}

function NodeStatus() {
  const c = useCluster();
  const clusterName = c.identity === "unknown" ? (c.connected ? "custom" : "—") : c.identity;
  return (
    <Link to="/settings" className="node-copy inline" aria-label={`RPC ${c.connected ? "connected" : "unreachable"}`}>
      <StatusDot on={c.connected} warn={!c.probed} />
      <span className="label">{clusterName}</span>
      <span className="address tabular">
        {c.slot ? `slot ${c.slot.toLocaleString()}` : !c.probed ? "connecting…" : "rpc unreachable"}
      </span>
    </Link>
  );
}

const NAV: readonly (readonly [string, string])[] = [
  ["/", "Launches"],
  ["/start", "Start"],
  ["/desks", "Desks"],
  ["/portfolio", "Portfolio"],
  ["/activity", "Activity"],
  ["/owed", "Owed"],
  ["/compare", "Compare"],
  ["/private", "Private"],
  ["/settings", "Settings"],
];

export function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const c = useCluster();
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className="rail">
          <div className="rail__brand">
            <Logo />
            <p className="muted fine">
              Private contribution.
              <br />
              Public settlement.
            </p>
          </div>
          <nav className="rail__section" aria-label="Primary">
            {NAV.map(([to, label]) => (
              <Link
                className="nav-link"
                aria-current={location.pathname === to ? "page" : undefined}
                to={to}
                key={to}
              >
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="rail__foot">
            <span className="label">Protocol posture</span>
            <p className="fine muted">
              Fail closed. Private value paths stay disabled until the connected cluster proves the required Token-2022
              capability.
            </p>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <div className="topbar__left">
              <span className="mobile-brand">
                <Logo />
              </span>
              <NodeStatus />
              {c.connected && !c.isDevnet && c.genesisHash && (
                <span className="badge badge--held">non-devnet rpc</span>
              )}
            </div>
            <div className="topbar__right">
              <WalletMultiButton className="wallet-button" />
            </div>
          </header>
          <main className="workspace" id="content">
            {children}
          </main>
        </div>
      </div>
      <Toasts />
    </>
  );
}

export function Toasts() {
  const { items, remove } = useToasts();
  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((t) => (
        <button className="toast" data-state={t.state} key={t.id} onClick={() => remove(t.id)}>
          <span className="label">{t.state}</span>
          <div>{t.title}</div>
          <div className="muted fine">{t.detail}</div>
          {t.signature && (
            <a
              href={explorerTx(t.signature)}
              target="_blank"
              rel="noreferrer"
              className="fine accent-text"
              style={{ display: "block", marginTop: 4 }}
              onClick={(e) => e.stopPropagation()}
            >
              View on Solana Explorer ↗
            </a>
          )}
        </button>
      ))}
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("route error", error, info.componentStack);
  }
  render() {
    if (this.state.error)
      return (
        <div className="callout callout--risk">
          <b>{this.props.label ?? "View"} failed.</b>
          <div>{this.state.error.message}</div>
        </div>
      );
    return this.props.children;
  }
}
