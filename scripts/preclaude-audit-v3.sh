#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
fail(){ echo "BLOCKED: $1" >&2; exit 1; }
cd "$root"

bash scripts/verify-mobile-foundation.sh
bash scripts/verify-visual-parity.sh
bash scripts/verify-rls-boundaries.sh
bash scripts/verify-contracts.sh
bash -n scripts/*.sh

python - <<'PY'
import json, glob
for p in glob.glob('**/package.json', recursive=True): json.load(open(p))
json.load(open('apps/mobile/app.json'))
PY

python - <<'PY'
from pathlib import Path
for p in sorted(Path('db/migrations').glob('*.sql')):
    s=p.read_text().upper()
    if s.count('BEGIN;') != s.count('COMMIT;'):
        raise SystemExit(f'Migration transaction mismatch: {p}')
PY

if grep -RInE "(password|secret|token|api[_-]?key)[[:space:]]*[:=][[:space:]]*['\"][^'\"]+['\"]" apps/mobile --exclude='*.md' --exclude='*.test.*' --exclude-dir=node_modules >/tmp/preclaude-secret-scan.txt; then
  cat /tmp/preclaude-secret-scan.txt
  fail "possible hardcoded secret assignment in mobile source"
fi

echo "PRE-CLAUDE STATIC AUDIT PASS"
