#!/usr/bin/env bash
set -euo pipefail
for p in norr-launch norr-claim norr-fees norr-market norr-boards norr-social norr-wrap; do test -s "programs/$p/src/lib.rs"; done
! rg -n '\bas\s+u(8|16|32|64)\b|\.unwrap\(|\.expect\(' programs --glob '*.rs'
echo "static source audit passed; this is not an Anchor build"
