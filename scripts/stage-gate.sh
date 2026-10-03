#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v pnpm >/dev/null 2>&1 || { echo "BLOCKED: pnpm is not installed"; exit 20; }

pnpm lint
pnpm typecheck
pnpm test
pnpm build

pnpm e2e

echo "STAGE GATE: GREEN"
