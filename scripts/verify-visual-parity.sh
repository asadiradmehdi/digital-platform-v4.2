#!/usr/bin/env bash
# Static Web ⇄ Mobile visual parity gate: every core semantic colour must carry the same value
# in the web CSS tokens (app/globals.css) and the shared design-token package used by mobile.
set -euo pipefail
TOKENS="packages/design-tokens/src/index.ts"
CSS="app/globals.css"
# css-var|token-key|value
pairs=(
  "--bg|bg|#F7F3EA"
  "--surface|surface|#FFFDF8"
  "--surface-2|surface2|#F1EBDD"
  "--surface-3|surface3|#E9E1CF"
  "--ink|ink|#0C1638"
  "--ink-2|ink2|#38405F"
  "--muted|muted|#6C6757"
  "--subtle|subtle|#958F7E"
  "--line|line|#E6DCCB"
  "--brand|accent|#16348A"
  "--brand-strong|accentStrong|#0B1B52"
  "--gold-1|gold1|#F2D390"
  "--gold-2|gold2|#D6A54C"
  "--gold-3|gold3|#A8762A"
  "--turquoise|turquoise|#12A39A"
  "--success|success|#0B7A73"
  "--danger|danger|#C0392B"
)
norm() { tr -d ' ' | tr '[:upper:]' '[:lower:]'; }
css_flat=$(norm < "$CSS")
tok_flat=$(norm < "$TOKENS")
for p in "${pairs[@]}"; do
  IFS='|' read -r var key val <<<"$p"
  v=$(printf "%s" "$val" | norm); k=$(printf "%s" "$key" | norm)
  grep -Fq -- "${var}:${v}" <<<"$css_flat" || { echo "VISUAL_PARITY_FAIL: $CSS missing ${var}: ${val}"; exit 1; }
  grep -Fq -- "${k}:'${v}'" <<<"$tok_flat" || { echo "VISUAL_PARITY_FAIL: $TOKENS missing ${key}: '${val}'"; exit 1; }
done
grep -Fq "color-scheme:light" <<<"$css_flat" || { echo "VISUAL_PARITY_FAIL: color-scheme"; exit 1; }
grep -Fq "ibmplexsansarabic" <<<"$css_flat" || { echo "VISUAL_PARITY_FAIL: web font"; exit 1; }
grep -Fq "ibmplexsansarabic" <<<"$tok_flat" || { echo "VISUAL_PARITY_FAIL: token font"; exit 1; }
echo 'VISUAL_PARITY_STATIC=PASS'
