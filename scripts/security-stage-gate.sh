#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 - "$ROOT" <<'PY'
from pathlib import Path
import re,sys
root=Path(sys.argv[1])
sql=(root/'db/migrations/0014_tenant_isolation_abuse_recovery.sql').read_text()
required=['ENABLE ROW LEVEL SECURITY','FORCE ROW LEVEL SECURITY','consume_rate_limit','backup_runs']
missing=[x for x in required if x not in sql]
if missing: raise SystemExit(f'Missing security migration markers: {missing}')
for p in [root/'scripts/backup.sh',root/'scripts/restore-verify.sh']:
    if not p.exists(): raise SystemExit(f'Missing {p}')
print('Static security gate PASS')
PY
