#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
for f in \
  "$ROOT/server/observability/logger.ts" \
  "$ROOT/server/observability/metrics.ts" \
  "$ROOT/server/observability/tracing.ts" \
  "$ROOT/server/observability/operational-events.ts" \
  "$ROOT/docs/OBSERVABILITY_RELIABILITY_V1.md" \
  "$ROOT/db/migrations/0018_observability_hardening.sql"; do
  [[ -f "$f" ]] || { echo "MISSING $f"; fail=1; }
done
if grep -RniE 'console\.log\([^)]*(password|token|secret|authorization|cookie|api[_-]?key)' "$ROOT/server" "$ROOT/app" 2>/dev/null; then
  echo "Potential secret-bearing console logging found"; fail=1
fi
if ! grep -q "deny_observability_mutation" "$ROOT/db/migrations/0018_observability_hardening.sql"; then
  echo "Append-only trigger missing"; fail=1
fi
if ! grep -q "parseTraceparent" "$ROOT/server/observability/tracing.ts"; then
  echo "Trace context parser missing"; fail=1
fi
if [[ "$fail" -ne 0 ]]; then exit 1; fi
echo "Observability static gate: PASS"
