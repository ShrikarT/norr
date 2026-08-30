const FRIENDLY: Record<string, string> = {
  P0Required: "Confidential transfers are not verified on this cluster.",
  ClusterMismatch: "The RPC endpoint is for a different cluster.",
  BpsMustTotalDenominator: "The split must total exactly 100%.",
  SlippageExceeded: "The quote changed beyond your limit. Review a fresh quote.",
  NotActive: "Setup is incomplete. This launch cannot accept value.",
  DirectCreditsEnabled: "The confidential vault is not safely closed to direct credits.",
  SettlementDestinationMismatch: "The settlement destination does not match the activated sale.",
};
export function humanizeProgramError(code: string): string { return FRIENDLY[code] ?? code.replace(/([a-z])([A-Z])/g, "$1 $2"); }
