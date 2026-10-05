#!/usr/bin/env bash
set -euo pipefail
TOKENS="packages/design-tokens/src/index.ts"
CSS="app/globals.css"
checks=(
  "--bg:#07080d"
  "--surface:#10131b"
  "--surface-2:#151924"
  "--surface-3:#1b202c"
  "--ink:#f6f7fb"
  "--muted:#969baa"
  "--line:#252a37"
  "--line-strong:#343b4b"
  "--accent:#a18aff"
  "--accent-strong:#c0b4ff"
  "--success:#41d39a"
  "--warning:#f4bd61"
  "--danger:#ff7187"
  "--info:#75b8ff"
)
for c in "${checks[@]}"; do grep -Fq -- "$c" "$CSS" || { echo "VISUAL_PARITY_FAIL: missing $c"; exit 1; }; done
grep -Fq "colors:" "$TOKENS" || { echo "VISUAL_PARITY_FAIL: token source missing"; exit 1; }
echo 'VISUAL_PARITY_STATIC=PASS'
