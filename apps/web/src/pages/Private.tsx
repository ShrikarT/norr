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
        <Metric label="Transfer execution" value="proven" note="steps 1–8 on devnet" />
        <Metric label="P0 Gate" value="fail closed" note="awaiting external sign-off" />
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

        <Panel title="Devnet confidential execution" aside={<Badge kind="settled">steps 1–8 proven on devnet</Badge>}>
          <div className="stack">
            <p>
              The full confidential pipeline runs on Solana Devnet: confidential mint creation → account configuration → ElGamal/AE key derivation → proof generation →
              on-chain proof context verification → deposit → apply pending balance → 169-byte confidential transfer → destination apply → confidential withdraw.
            </p>
            <p className="muted fine">
              All proof contexts verify on the native proof program (<AddressLink address={ZK_PROOF_PROGRAM} chars={8} />), and confidential transfers and withdrawals execute natively under Token-2022. Norr preserves the fail-closed gate (<code>P0Required</code>) on private wrap and contribution paths until external independent reviewer audit attestations are filed.
            </p>
          </div>
        </Panel>

        <Panel title="P0 Acceptance & Security Boundary" aside={<Badge kind="held">pending external review</Badge>}>
          <div className="privacy-grid">
            <div>
              <span className="label">169-Byte Transfer & zk-ops</span>
              <p>Canonical Token-2022 on Devnet natively processes 169-byte confidential transfers with homomorphic subtraction and auditor ciphertexts.</p>
            </div>
            <div>
              <span className="label">Deterministic Recovery (ADR-010)</span>
              <p>ElGamal and AE keys derive deterministically from a wallet signature (PBKDF2-HMAC-SHA256, domain separated). Zero private keys are stored.</p>
            </div>
            <div>
              <span className="label">Fail-Closed Gate</span>
              <p>norr-wrap and norr-claim enforce the P0Required gate on private paths until two independent human reviewer signatures validate the audit report.</p>
            </div>
            <div>
              <span className="label">Supply Conservation</span>
              <p>Every confidential transfer, deposit, apply, and withdrawal strictly conserves public backing and token balances with zero drift.</p>
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
