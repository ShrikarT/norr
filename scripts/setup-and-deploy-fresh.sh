#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

RPC="https://api.devnet.solana.com"
mkdir -p target/deploy

echo "=== Generating 7 fresh keypairs ==="
for name in launch claim fees market boards social wrap; do
  solana-keygen new --no-bip39-passphrase --silent --force -o "target/deploy/norr_${name}-keypair.json"
done

echo "=== Extracting public keys ==="
cat <<EOF > program-ids.json
{
  "norr_launch": "$(solana-keygen pubkey target/deploy/norr_launch-keypair.json)",
  "norr_claim": "$(solana-keygen pubkey target/deploy/norr_claim-keypair.json)",
  "norr_fees": "$(solana-keygen pubkey target/deploy/norr_fees-keypair.json)",
  "norr_market": "$(solana-keygen pubkey target/deploy/norr_market-keypair.json)",
  "norr_boards": "$(solana-keygen pubkey target/deploy/norr_boards-keypair.json)",
  "norr_social": "$(solana-keygen pubkey target/deploy/norr_social-keypair.json)",
  "norr_wrap": "$(solana-keygen pubkey target/deploy/norr_wrap-keypair.json)"
}
EOF

echo "=== Synchronizing program IDs across codebase ==="
source ~/.nvm/nvm.sh
pnpm exec tsx scripts/sync-program-ids.ts

echo "=== Building all 7 programs with matching declare_id! ==="
bash scripts/build-all-sbf.sh

echo "=== Deploying all 7 programs to Devnet ==="
bash scripts/deploy-programs.sh

echo "=== Fresh deployment completed successfully! ==="
