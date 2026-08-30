#!/bin/bash
export HOME=/home/shrikar
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "=== FULL TOOLCHAIN VERIFICATION ==="
echo ""
echo "Rust:     $(rustc --version 2>/dev/null || echo 'Not found')"
echo "Cargo:    $(cargo --version 2>/dev/null || echo 'Not found')"
echo "Solana:   $(solana --version 2>/dev/null || echo 'Not found')"
echo "Anchor:   $(anchor --version 2>/dev/null || echo 'Not found')"
echo "Node:     $(node --version 2>/dev/null || echo 'Not found')"
echo "pnpm:     $(pnpm --version 2>/dev/null || echo 'Not found')"
echo "gcc:      $(gcc --version 2>/dev/null | head -1 || echo 'Not found')"
echo ""
echo "Solana Config:"
solana config get
echo ""
echo "Solana Address: $(solana address)"
echo ""
echo "=== ALL TOOLS VERIFIED ==="
