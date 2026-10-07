#!/usr/bin/env bash
set -euo pipefail
TOKENS="packages/design-tokens/src/index.ts"
CSS="app/globals.css"
checks=(
  "--bg:#f7f9fc"
  "--surface:#ffffff"
  "--surface-2:#f3f5f8"
  "--surface-3:#eaecef"
  "--ink:#0d1117"
  "--muted:#5c6474"
  "--subtle:#8898a8"
  "--accent:#1a56db"
  "--accent-strong:#1044b5"
  "--success:#16a34a"
  "--warning:#d97706"
  "--danger:#dc2626"
  "--info:#0284c7"
  "color-scheme:light"
)
for c in "${checks[@]}"; do grep -Fq -- "$c" "$CSS" || { echo "VISUAL_PARITY_FAIL: missing $c"; exit 1; }; done
grep -Fq "colors:" "$TOKENS" || { echo "VISUAL_PARITY_FAIL: token source missing"; exit 1; }
grep -Fq "'#1a56db'" "$TOKENS" || { echo "VISUAL_PARITY_FAIL: token accent not updated"; exit 1; }
grep -Fq "'#f7f9fc'" "$TOKENS" || { echo "VISUAL_PARITY_FAIL: token bg not updated"; exit 1; }
grep -Fq "'#0d1117'" "$TOKENS" || { echo "VISUAL_PARITY_FAIL: token ink not updated"; exit 1; }
echo 'VISUAL_PARITY_STATIC=PASS'
