#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo '[1/7] Required architecture/docs'
for f in CLAUDE.md START_HERE_FOR_CLAUDE.md docs/ARCHITECTURE.md docs/DB_SCHEMA_v1.md docs/API.md docs/FINAL_PRE_CLAUDE_AUDIT_v3.md docs/handoff/PRE_CLAUDE_FINAL_BOUNDARY_v1.md; do test -f "$f" || { echo "MISSING $f"; exit 1; }; done

echo '[2/7] Route surface'
for d in app/dashboard app/ai app/services app/social app/automation app/orders app/wallet app/subscriptions app/analytics app/support app/security app/settings; do test -d "$d" || { echo "MISSING $d"; exit 1; }; done

echo '[3/7] Mobile surface'
for f in apps/mobile/app/_layout.tsx apps/mobile/src/auth/AuthProvider.tsx apps/mobile/src/components/Ui.tsx apps/mobile/src/theme/index.ts; do test -f "$f" || exit 1; done

echo '[4/7] Security scripts'
test -x scripts/security-audit.sh
test -x scripts/verify-rls-boundaries.sh

echo '[5/7] API contracts'
grep -q "API_VERSION = 'v1'" packages/api-contracts/src/index.ts
grep -q "subscriptions" packages/api-contracts/src/index.ts
grep -q "notifications" packages/api-contracts/src/index.ts

echo '[6/7] Migration transaction balance'
python3 - <<'PY'
from pathlib import Path
for p in Path('db/migrations').glob('*.sql'):
    s=p.read_text().upper()
    if s.count('BEGIN;') != s.count('COMMIT;'):
        raise SystemExit(f'Unbalanced migration: {p}')
print('PASS')
PY

echo '[7/7] Secret hygiene'
if grep -RInE --exclude-dir=.git --exclude='*.md' '(sk-[A-Za-z0-9]{20,}|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|AKIA[0-9A-Z]{16})' . >/tmp/preclaude-secret-scan.txt; then
  cat /tmp/preclaude-secret-scan.txt
  echo 'Potential secret pattern found'
  exit 1
fi

echo 'PRE-CLAUDE STATIC BOUNDARY: PASS'
