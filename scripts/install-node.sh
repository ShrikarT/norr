#!/bin/bash
set -e
export HOME=/home/shrikar

echo "=== Installing Node.js 22 via nvm ==="
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Source nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Install Node 22
nvm install 22
nvm use 22
nvm alias default 22

echo ""
echo "=== Installing pnpm ==="
corepack enable 2>/dev/null || npm install -g pnpm@10.34.5
pnpm --version

echo ""
echo "=== Node.js verification ==="
node --version
npm --version

echo ""
echo "=== Configuring Solana for devnet ==="
source "$HOME/.cargo/env"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana config set --url devnet
solana config get

echo "=== Done ==="
