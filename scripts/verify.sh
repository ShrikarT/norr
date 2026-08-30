#!/usr/bin/env bash
set -euo pipefail
pnpm test
pnpm -r typecheck
if command -v cargo >/dev/null; then cargo fmt --all -- --check; cargo clippy --workspace --all-targets -- -D warnings; else echo "rust toolchain absent; Rust verification not claimed"; fi
python3 scripts/secret-scan.py
./scripts/audit-source.sh
