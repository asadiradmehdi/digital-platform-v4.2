#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
fail=0
check_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    printf 'OK   %-12s %s\n' "$cmd" "$(command -v "$cmd")"
  else
    printf 'MISS %-12s\n' "$cmd"
    fail=1
  fi
}
check_cmd node
check_cmd corepack
check_cmd git

if command -v node >/dev/null 2>&1; then
  node -e 'const [M,m,p]=process.versions.node.split(".").map(Number); process.exit(M===22 && m>=16 ? 0 : 1)' \
    && echo "OK   node-version  $(node --version)" \
    || { echo "FAIL node-version  required >=22.16 <23"; fail=1; }
fi

if command -v pnpm >/dev/null 2>&1; then
  echo "INFO pnpm          $(pnpm --version)"
else
  echo "INFO pnpm          not installed yet; bootstrap.sh can provision it"
fi

if [[ -d node_modules ]]; then
  echo "OK   dependencies  node_modules present"
else
  echo "INFO dependencies  node_modules absent; run ./scripts/bootstrap.sh"
fi

if [[ -d e2e ]]; then echo "OK   e2e            directory present"; else echo "FAIL e2e            directory missing"; fail=1; fi
if [[ -f playwright.config.ts ]]; then echo "OK   playwright     config present"; else echo "FAIL playwright     config missing"; fail=1; fi
if [[ -f db/migrations/0001_initial_schema.sql ]]; then echo "OK   database       initial migration present"; else echo "FAIL database       migration missing"; fail=1; fi

if [[ "$fail" -eq 0 ]]; then
  echo "DOCTOR: PASS"
else
  echo "DOCTOR: FAIL"
fi
exit "$fail"
