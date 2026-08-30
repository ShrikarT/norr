#!/bin/bash
set -e
export HOME=/home/shrikar
source "$HOME/.cargo/env"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

echo "=== Checking cc linker ==="
which cc || echo "No cc found, installing build-essential..."
which cc || {
    sudo apt-get update -qq
    sudo apt-get install -y -qq build-essential pkg-config libudev-dev libssl-dev
}
cc --version

echo ""
echo "=== Installing Anchor CLI 0.31.1 ==="
cargo install --git https://github.com/coral-xyz/anchor --tag v0.31.1 anchor-cli --locked --force

echo ""
echo "=== Verification ==="
rustc --version
cargo --version
solana --version
anchor --version

echo ""
echo "=== Configuring Solana for devnet ==="
solana config set --url devnet
solana config get

echo ""
echo "=== Generating Solana keypair (if needed) ==="
if [ ! -f "$HOME/.config/solana/id.json" ]; then
    solana-keygen new --no-bip39-passphrase --outfile "$HOME/.config/solana/id.json"
    echo "Keypair generated"
else
    echo "Keypair already exists"
fi
solana address

echo ""
echo "=== Adding paths to .bashrc ==="
grep -q 'cargo/env' "$HOME/.bashrc" 2>/dev/null || echo 'source "$HOME/.cargo/env"' >> "$HOME/.bashrc"
grep -q 'solana/install' "$HOME/.bashrc" 2>/dev/null || echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> "$HOME/.bashrc"

echo "=== ALL TOOLS INSTALLED ==="
