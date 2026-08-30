import { useCluster } from "../lib/status";
import { CT_EVIDENCE, TOKEN_2022_PROGRAM, ZK_PROOF_PROGRAM } from "../lib/config";
import { AddressLink, Badge, Metric, PageHead, Panel, TxLink } from "../components/primitives";

export function Private() {
  const c = useCluster();
  const ev = c.ctEvidence;
  const verified = ev.mintLive && ev.accountLive && ev.proofContextsLive === 3;

  return (
    <>
      <PageHead
        kicker="§ protocol / confidential workspace"
        title={
          <>
            Private <em>contribution</em>
          </>
        }
        copy="Contribution amounts are encrypted with Token-2022 confidential transfers: Twisted ElGamal ciphertexts with zero-knowledge equality, validity, and range proofs verified by the native ZK ElGamal proof program."
      />

      <div className="grid grid--metrics">
        <Metric label="Setup pipeline" value={ev.checked ? (verified ? "proven" : "partial") : "verifying…"} note="steps 1–5 on devnet" />
        <Metric label="Proof contexts" value={ev.checked ? `${ev.proofContextsLive} / 3` : "…"} note="live on ZK proof program" />
        <Metric label="Transfer execution" value="fail closed" note="upstream zk-ops disabled" />
        <Metric label="Fallback ledger" value="none" note="by design" />
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        <Panel
          title="Devnet evidence"
          aside={<Badge kind={verified ? "settled" : "held"}>{ev.checked ? (verified ? "re-verified live" : "checking failed") : "verifying…"}</Badge>}
        >
          <div className="stack">
            <p className="muted fine">
              Every address below is re-read from the connected RPC on page load — the badge above reflects the live
              result, not a cached claim.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Artifact</th>
                    <th>Address</th>
                    <th>Live</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Confidential mint (CT mint extension)</td>
                    <td>
                      <AddressLink address={CT_EVIDENCE.mint} chars={8} />
                    </td>
                    <td>{live(ev.checked, ev.mintLive)}</td>
                  </tr>
                  <tr>
                    <td>Configured CT token account (469 B)</td>
                    <td>
                      <AddressLink address={CT_EVIDENCE.tokenAccount} chars={8} />
                    </td>
                    <td>{live(ev.checked, ev.accountLive)}</td>
                  </tr>
                  <tr>
                    <td>Equality proof context</td>
                    <td>
                      <AddressLink address={CT_EVIDENCE.equalityProofContext} chars={8} />
                    </td>
                    <td>{live(ev.checked, ev.proofContextsLive >= 1)}</td>
                  </tr>
                  <tr>
                    <td>3-handles validity proof context</td>
                    <td>
                      <AddressLink address={CT_EVIDENCE.validityProofContext} chars={8} />
                    </td>
                    <td>{live(ev.checked, ev.proofContextsLive >= 2)}</td>
                  </tr>
                  <tr>
                    <td>128-bit range proof context</td>
                    <td>
                      <AddressLink address={CT_EVIDENCE.rangeProofContext} chars={8} />
                    </td>
                    <td>{live(ev.checked, ev.proofContextsLive >= 3)}</td>
                  </tr>
                  <tr>
                    <td>Mint creation transaction</td>
                    <td>
                      <TxLink signature={CT_EVIDENCE.mintCreateTx} />
                    </td>
                    <td className="muted fine">explorer</td>
                  </tr>
                  <tr>
                    <td>Confidential deposit + apply</td>
                    <td>
                      <TxLink signature={CT_EVIDENCE.depositTx} />
                    </td>
                    <td className="muted fine">explorer</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <Panel title="Where execution stops" aside={<Badge kind="held">upstream boundary</Badge>}>
          <div className="stack">
            <p>
              The pipeline runs mint creation → account configuration → ElGamal/AE key derivation → proof generation →
              on-chain proof context verification → deposit → apply pending balance, all confirmed on Devnet. The next
              step, <code>ConfidentialTransferInstruction::Transfer</code>, fails because the canonical Token-2022
              program deployed at <AddressLink address={TOKEN_2022_PROGRAM} chars={8} /> on every public cluster was
              compiled without the <code>zk-ops</code> feature:
            </p>
            <pre className="log-block">
{`Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]
Program log: ConfidentialTransferInstruction::Transfer
Program log: Error: InvalidInstructionData
Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb failed: invalid instruction data`}
            </pre>
            <p className="muted fine">
              The proof contexts themselves verified successfully on the native proof program (
              <AddressLink address={ZK_PROOF_PROGRAM} chars={8} />) — the cryptography is sound; the token program's
              transfer handler is compiled out. Norr keeps wrap, transfer, withdraw, and unwrap fail closed
              (<code>P0Required</code>) rather than substituting an unverified ledger. There is no fallback ledger and
              no simulated success anywhere in this application.
            </p>
          </div>
        </Panel>

        <Panel title="What unlocks it">
          <div className="privacy-grid">
            <div>
              <span className="label">Upstream activation</span>
              <p>Anza ships the Core BPF Token-2022 build with zk-ops enabled. Norr's pipeline resumes with zero architecture changes.</p>
            </div>
            <div>
              <span className="label">Local integration target</span>
              <p>A local validator with an officially built Token-2022 (zk-ops on) can exercise the full flow end to end. That is a development target, never devnet evidence.</p>
            </div>
            <div>
              <span className="label">Fail-closed gate</span>
              <p>norr-wrap and norr-claim verify a signed target-cluster execution report before enabling private paths. No report, no value movement.</p>
            </div>
            <div>
              <span className="label">Key custody</span>
              <p>ElGamal and AE keys derive from a wallet signature (PBKDF2, domain separated). Nothing secret is stored by the app.</p>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

function live(checked: boolean, ok: boolean) {
  if (!checked) return <span className="muted fine">…</span>;
  return ok ? <span className="gain fine">confirmed</span> : <span className="loss fine">not found</span>;
}
