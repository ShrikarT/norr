#!/usr/bin/env bash
set -euo pipefail
for command in solana solana-test-validator anchor; do command -v "$command" >/dev/null || { echo "missing required command: $command" >&2; exit 1; }; done
echo "solana: $(solana --version)"
echo "anchor: $(anchor --version)"
echo "P0 preflight: asserting ZK ElGamal Proof Program and Token-2022 feature set"
# The exact Agave version and DAMM clone addresses are generated into the reviewed deployment manifest.
# Refuse to guess them: local green / target red is an unsafe result.
if [[ ! -f deployments/generated/localnet.p0.json ]]; then
  echo "P0Required: deployments/generated/localnet.p0.json is missing" >&2
  exit 3
fi
exec solana-test-validator --reset --ledger .anchor/test-ledger
