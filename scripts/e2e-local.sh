#!/usr/bin/env bash
set -euo pipefail
[[ -f deployments/generated/localnet.p0.json ]] || { echo "P0Required: funded CT + refund report missing" >&2; exit 3; }
anchor test --skip-local-validator
