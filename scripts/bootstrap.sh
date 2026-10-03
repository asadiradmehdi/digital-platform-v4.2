#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

required_node_major=22
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [[ "$node_major" != "$required_node_major" ]]; then
  echo "BLOCKED: Node.js 22.x is required; found $(node --version 2>/dev/null || echo unavailable)."
  exit 21
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "BLOCKED: corepack is required to provision pnpm."
  exit 22
fi

corepack enable
corepack prepare pnpm@10.15.0 --activate
pnpm --version
pnpm install
pnpm exec playwright install chromium

echo "BOOTSTRAP: READY"
