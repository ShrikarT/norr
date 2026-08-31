#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

for p in norr-boards norr-claim norr-fees norr-market norr-launch norr-social norr-wrap; do
  echo "=== Building $p ==="
  cargo-build-sbf --manifest-path "programs/$p/Cargo.toml"
done
echo "=== All 7 programs built successfully ==="
