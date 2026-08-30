export type Commitment = "processed" | "confirmed" | "finalized";
export type TransactionStage = "simulating" | "awaiting-signature" | "sent" | Commitment | "rejected" | "expired" | "failed";
export type TransactionUpdate = Readonly<{ stage: TransactionStage; signature?: string; consumedComputeUnits?: number; error?: string }>;
export type TransactionPlanStep<TInstruction> = Readonly<{ id: string; label: string; instructions: readonly TInstruction[]; dependsOn?: readonly string[] }>;
export type Simulation = Readonly<{ ok: boolean; consumedComputeUnits: number; logs: readonly string[]; error?: string }>;
export interface TransactionTransport<TInstruction> {
  simulate(instructions: readonly TInstruction[]): Promise<Simulation>;
  signSendConfirm(instructions: readonly TInstruction[], onCommitment: (stage: Commitment, signature: string) => void): Promise<string>;
}
export class TransactionPlan<TInstruction> {
  constructor(readonly steps: readonly TransactionPlanStep<TInstruction>[]) { this.assertAcyclic(); }
  private assertAcyclic(): void {
    const ids = new Set(this.steps.map((step) => step.id));
    for (const step of this.steps) for (const dependency of step.dependsOn ?? []) if (!ids.has(dependency)) throw new Error(`unknown dependency ${dependency}`);
  }
  async execute(transport: TransactionTransport<TInstruction>, completed: ReadonlySet<string>, update: (step: string, state: TransactionUpdate) => void): Promise<Set<string>> {
    const done = new Set(completed);
    for (const step of this.steps) {
      if (done.has(step.id)) continue;
      if ((step.dependsOn ?? []).some((dependency) => !done.has(dependency))) throw new Error(`step ${step.id} dependency incomplete`);
      update(step.id, { stage: "simulating" });
      const simulation = await transport.simulate(step.instructions);
      if (!simulation.ok) { update(step.id, { stage: "failed", error: simulation.error ?? "simulation failed", consumedComputeUnits: simulation.consumedComputeUnits }); throw new Error(simulation.error ?? "simulation failed"); }
      update(step.id, { stage: "awaiting-signature", consumedComputeUnits: simulation.consumedComputeUnits });
      try {
        const signature = await transport.signSendConfirm(step.instructions, (stage, value) => update(step.id, { stage, signature: value, consumedComputeUnits: simulation.consumedComputeUnits }));
        update(step.id, { stage: "finalized", signature, consumedComputeUnits: simulation.consumedComputeUnits });
        done.add(step.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stage = /reject/i.test(message) ? "rejected" : /blockhash|expired/i.test(message) ? "expired" : "failed";
        update(step.id, { stage, error: message, consumedComputeUnits: simulation.consumedComputeUnits });
        throw error;
      }
    }
    return done;
  }
}
