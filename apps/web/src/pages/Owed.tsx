import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useCluster } from "../lib/status";
import { PROGRAM_IDS, short } from "../lib/config";
import { CapabilityGate, Empty, PageHead, Panel } from "../components/primitives";

export function Owed() {
  const wallet = useWallet();
  const c = useCluster();
  const feesLive = c.programsDeployed?.fees === true;

  return (
    <>
      <PageHead
        kicker="§ account / entitlements"
        title={
          <>
            Owed to <em>you</em>
          </>
        }
        copy="norr-fees accrues each recipient's share with exact delta accounting: entitlement is order independent, donation surplus is isolated, and accrual never moves backward."
      />
      <div className="stack">
        {!wallet.connected ? (
          <Panel title="Wallet">
            <div className="stack" style={{ alignItems: "start" }}>
              <p className="muted">Connect the wallet listed as a split recipient to read its accrued balance.</p>
              <WalletMultiButton className="wallet-button" />
            </div>
          </Panel>
        ) : !feesLive ? (
          <CapabilityGate
            title="Fee accrual"
            reason={
              <>
                norr-fees ({short(PROGRAM_IDS.fees)}) is not deployed on the connected cluster, so no router accounts
                exist to read entitlements from. This page lists real accrued balances — and a release action that
                submits the release instruction — once the program is live.
              </>
            }
          />
        ) : (
          <Panel title="Accrued splits">
            <Empty>No router accounts found naming this wallet as a recipient.</Empty>
          </Panel>
        )}
        <Panel title="How accrual works">
          <div className="privacy-grid">
            <div>
              <span className="label">Exact delta</span>
              <p>Each deposit is split by basis points; the largest share receives the atomic-unit remainder, so the sum always equals the deposit.</p>
            </div>
            <div>
              <span className="label">Order independent</span>
              <p>Release order cannot change any recipient's entitlement. Releasing early or late yields identical totals.</p>
            </div>
            <div>
              <span className="label">Donation isolation</span>
              <p>Tokens sent directly to a vault are surplus, not revenue. They never inflate recognized reserves or entitlements.</p>
            </div>
            <div>
              <span className="label">Monotonic</span>
              <p>Accrued counters only increase. A release records what was paid; it can never rewind accrual.</p>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
