#!/usr/bin/env bash
# Static Web ⇄ Mobile visual parity gate: every core semantic colour must carry the same value
# in the web CSS tokens (app/globals.css) and the shared design-token package used by mobile.
set -euo pipefail
TOKENS="packages/design-tokens/src/index.ts"
CSS="app/globals.css"
# css-var|token-key|value
pairs=(
  "--bg|bg|#F5F0E6"
  "--surface|surface|#FFFCF6"
  "--surface-2|surface2|#EFE9DC"
  "--surface-3|surface3|#E6DECD"
  "--ink|ink|#0B1233"
  "--ink-2|ink2|#3A3F5C"
  "--muted|muted|#5F6378"
  "--subtle|subtle|#8D90A0"
  "--line|line|#E3DACA"
  "--brand|accent|#142257"
  "--brand-strong|accentStrong|#0A1238"
  "--gold-1|gold1|#F2D390"
  "--gold-2|gold2|#D4A24C"
  "--gold-3|gold3|#A8762A"
  "--turquoise|turquoise|#169A8C"
  "--success|success|#0E7569"
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
