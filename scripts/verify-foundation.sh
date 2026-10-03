#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
report="docs/implementation/FOUNDATION_VERIFICATION.md"
{
  echo '# Foundation Verification'; echo; echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo;
  echo '## Environment'; node --version; corepack --version || true; pnpm --version || true; echo;
  echo '## Checks';
  pnpm lint; pnpm typecheck; pnpm test; pnpm build; pnpm e2e;
  echo; echo '## Result'; echo 'GREEN';
} | tee "$report"
