#!/usr/bin/env bash
set -euo pipefail
RPC="https://api.devnet.solana.com"

for id in Hh8FAARfcY4e9MJSMVpfv4eae8aeA94a4gyHRJhrtkcr GL8hxTuRfXZQMZfvS4RNoT8D1EVKSUpQTLZKsQq9oJaE 4aou9742wef3vMVnZdSUs66G9GvDDJUrmvTHTKLBx2jk D8PSneY6UbBgj5tv5FNxa7FoEzHPwobvdcoAXBphPqTY E2yvUMyHW1WvqLGA9DNNeEk44b1toJDwk1RoseEYham8 BjF6Y5RUpD3KufxV4VPeS6thYnQNt6Cas6hfQXdqf6Rn; do
  echo "Closing $id..."
  solana program close "$id" --url "$RPC" --bypass-warning || true
done
echo "Reclaimed balance:"
solana balance --url "$RPC"
