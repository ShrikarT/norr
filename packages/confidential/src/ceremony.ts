export type P0Measurement = {
  signature: string;
  computeUnits: number;
  transactionSize: number;
};

export type P0Report = {
  schema: string;
  clusterGenesisHash: string;
  solanaVersion: string;
  token2022Program: string;
  zkProofProgram: string;
  setup: {
    mintId: string;
    saleId: string;
  };
  transactions: {
    contribute: P0Measurement;
  };
  keyCeremonyOutputs: {
    auditorPubkey: string;
  };
  isSimulated: boolean;
};

export function verifyP0Report(report: P0Report | null | undefined): boolean {
  if (!report) return false;
  if (report.isSimulated) return false;
  if (!report.clusterGenesisHash || report.clusterGenesisHash === "dummy-genesis-hash" || report.clusterGenesisHash === "fake") return false;
  if (!report.transactions?.contribute?.signature || report.transactions.contribute.signature === "fake") return false;
  if (!report.keyCeremonyOutputs?.auditorPubkey || report.keyCeremonyOutputs.auditorPubkey === "fake") return false;
  return true;
}

export function assertConfidentialCapability(report?: P0Report | null): void {
  if (!verifyP0Report(report)) {
    throw new Error("P0Required: Target cluster does not possess a verified, non-simulated Token-2022 confidential transfer report.");
  }
}
