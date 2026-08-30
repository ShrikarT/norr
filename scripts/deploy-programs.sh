#!/usr/bin/env bash
# Deploy the seven Norr programs to Devnet.
#
# Prerequisites:
#   - Agave/Solana CLI >= 2.x on PATH (cargo-build-sbf, solana)
#   - A funded Devnet payer at ~/.config/solana/id.json (~26 SOL free covers
#     all seven programs incl. temporary buffer accounts; ~13.2 SOL final rent)
#   - The program keypairs matching the declare_id! values, in target/deploy/
#     (norr_<name>-keypair.json). These are generated at build time and are
#     intentionally NOT committed to git.
#
# Build (deterministic, honors Cargo.lock):
#   for p in norr-boards norr-claim norr-fees norr-market norr-launch norr-social norr-wrap; do
#     cargo-build-sbf --manifest-path "programs/$p/Cargo.toml" -- --locked
#   done
#
# NOTE: build each program with its own manifest as above. A joint
# `cargo-build-sbf --workspace` build unifies the `cpi`/`no-entrypoint`
# features across crates and strips entrypoints from every program that
# norr-launch depends on.
set -euo pipefail
cd "$(dirname "$0")/.."

CLUSTER_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"

for name in launch claim fees market boards social wrap; do
  so="target/deploy/norr_${name}.so"
  kp="target/deploy/norr_${name}-keypair.json"
  [ -f "$so" ] || { echo "missing $so — build first"; exit 1; }
  [ -f "$kp" ] || { echo "missing $kp — program keypair required"; exit 1; }
  echo "== deploying norr-${name} ($(solana-keygen pubkey "$kp"))"
  solana program deploy "$so" \
    --program-id "$kp" \
    --url "$CLUSTER_URL" \
    --commitment confirmed
done

echo "== verifying"
for name in launch claim fees market boards social wrap; do
  kp="target/deploy/norr_${name}-keypair.json"
  solana program show "$(solana-keygen pubkey "$kp")" --url "$CLUSTER_URL" || true
done

echo
echo "Now update deployments/devnet.json: set status, deployment slots, and"
echo "upgrade authority from the 'solana program show' output above."
