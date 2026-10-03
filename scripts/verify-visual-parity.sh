#!/usr/bin/env bash
set -euo pipefail
TOKENS="packages/design-tokens/src/index.ts"
CSS="app/globals.css"
checks=(
  "--bg:#090a0f"
  "--surface:#11131a"
  "--surface-2:#161922"
  "--surface-3:#1b1e28"
  "--ink:#f7f7fb"
  "--muted:#9b9fad"
  "--line:#282c38"
  "--line-strong:#343947"
  "--accent:#9b87ff"
  "--accent-strong:#b7a8ff"
  "--success:#41d39a"
  "--warning:#f4bd61"
  "--danger:#ff7187"
  "--info:#75b8ff"
)
for c in "${checks[@]}"; do grep -Fq -- "$c" "$CSS" || { echo "VISUAL_PARITY_FAIL: missing $c"; exit 1; }; done
grep -Fq "colors:" "$TOKENS" || { echo "VISUAL_PARITY_FAIL: token source missing"; exit 1; }
echo 'VISUAL_PARITY_STATIC=PASS'
