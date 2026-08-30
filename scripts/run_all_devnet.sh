#!/usr/bin/env bash
set -euo pipefail
[[ "${CLUSTER:-}" == "devnet" ]] || { echo "Set CLUSTER=devnet explicitly" >&2; exit 2; }
[[ -n "${P0_REPORT_PATH:-}" ]] || { echo "P0Required: P0_REPORT_PATH" >&2; exit 3; }
pnpm --filter @norr/cli dev -- sale:verify
