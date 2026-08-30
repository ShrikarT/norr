import { useState, useCallback } from "react";
import { TransactionPlan, type TransactionTransport, type TransactionUpdate, type TransactionStage } from "@norr/sdk";

export type RunnerStatus = Readonly<{
  active: boolean;
  stepId: string | null;
  stage: TransactionStage;
  signature?: string | undefined;
  consumedComputeUnits?: number | undefined;
  error?: string | undefined;
}>;

export function useTransactionRunner() {
  const [status, setStatus] = useState<RunnerStatus>({
    active: false,
    stepId: null,
    stage: "processed",
  });

  const runPlan = useCallback(
    async <TInstruction>(
      plan: TransactionPlan<TInstruction>,
      transport: TransactionTransport<TInstruction>,
      onComplete?: () => void
    ) => {
      setStatus({ active: true, stepId: null, stage: "simulating" });
      try {
        await plan.execute(transport, new Set(), (stepId: string, update: TransactionUpdate) => {
          setStatus({
            active: update.stage !== "finalized" && update.stage !== "failed" && update.stage !== "rejected",
            stepId,
            stage: update.stage,
            signature: update.signature,
            consumedComputeUnits: update.consumedComputeUnits,
            error: update.error,
          });
        });
        if (onComplete) onComplete();
      } catch (err: any) {
        setStatus((prev) => ({
          ...prev,
          active: false,
          stage: "failed",
          error: err?.message || String(err),
        }));
      }
    },
    []
  );

  const reset = useCallback(() => {
    setStatus({ active: false, stepId: null, stage: "processed" });
  }, []);

  return { status, runPlan, reset };
}
