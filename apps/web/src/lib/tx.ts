import { useCallback, useState } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { Instruction } from "@norr/sdk";

export type TxStage =
  | "idle"
  | "simulating"
  | "awaiting-signature"
  | "sent"
  | "confirmed"
  | "failed"
  | "rejected";

export type TxState = Readonly<{
  stage: TxStage;
  signature: string | null;
  error: string | null;
  computeUnits: number | null;
  logs: readonly string[];
}>;

const IDLE: TxState = { stage: "idle", signature: null, error: null, computeUnits: null, logs: [] };

export function toWeb3Instruction(ix: Instruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((a) => ({
      pubkey: new PublicKey(a.pubkey),
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    })),
    data: Buffer.from(ix.data),
  });
}

function classifyError(message: string): TxStage {
  return /reject|denied|cancell?ed/i.test(message) ? "rejected" : "failed";
}

/**
 * The single write path for the app: simulate first, refuse to send on
 * simulation failure, then wallet sign, send, confirm. Never reports success
 * for a transaction that did not confirm on the cluster.
 */
export function useTx() {
  const [state, setState] = useState<TxState>(IDLE);
  const reset = useCallback(() => setState(IDLE), []);

  const run = useCallback(
    async (
      connection: Connection,
      wallet: WalletContextState,
      instructions: readonly TransactionInstruction[]
    ): Promise<string | null> => {
      if (!wallet.publicKey || !wallet.sendTransaction) {
        setState({ ...IDLE, stage: "failed", error: "Wallet is not connected." });
        return null;
      }
      setState({ ...IDLE, stage: "simulating" });
      try {
        const latest = await connection.getLatestBlockhash("confirmed");
        const tx = new Transaction({
          feePayer: wallet.publicKey,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        }).add(...instructions);

        const sim = await connection.simulateTransaction(tx);
        const logs = sim.value.logs ?? [];
        if (sim.value.err) {
          let detail = logs.filter((l) => /error|failed/i.test(l)).slice(-2).join(" · ");
          if (sim.value.err === "AccountNotFound") {
            detail = "Wallet account not found on Devnet. Please fund your wallet with Devnet SOL to pay transaction rent and fees.";
          }
          setState({
            stage: "failed",
            signature: null,
            error: detail || `Simulation failed: ${JSON.stringify(sim.value.err)}`,
            computeUnits: sim.value.unitsConsumed ?? null,
            logs,
          });
          return null;
        }

        setState({
          stage: "awaiting-signature",
          signature: null,
          error: null,
          computeUnits: sim.value.unitsConsumed ?? null,
          logs,
        });
        const signature = await wallet.sendTransaction(tx, connection);
        setState((prev) => ({ ...prev, stage: "sent", signature }));

        const conf = await connection.confirmTransaction(
          { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
          "confirmed"
        );
        if (conf.value.err) {
          setState((prev) => ({
            ...prev,
            stage: "failed",
            error: `Transaction failed on-chain: ${JSON.stringify(conf.value.err)}`,
          }));
          return null;
        }
        setState((prev) => ({ ...prev, stage: "confirmed" }));
        return signature;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState((prev) => ({ ...prev, stage: classifyError(message), error: message }));
        return null;
      }
    },
    []
  );

  return { state, run, reset };
}
