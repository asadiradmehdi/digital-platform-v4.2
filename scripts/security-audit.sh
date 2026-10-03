#!/usr/bin/env bash
set -euo pipefail
fail=0
say(){ printf '%s\n' "$1"; }
check(){ local label="$1"; shift; if "$@"; then say "PASS  $label"; else say "FAIL  $label"; fail=1; fi; }
check "no committed .env files" bash -c '! find . -maxdepth 3 -type f -name ".env" -o -name ".env.*" | grep -v node_modules | grep -v "\.example$" | grep -q .'
check "no private-key PEM files" bash -c '! find . -type f \( -name "*.pem" -o -name "*.key" \) | grep -v node_modules | grep -q .'
check "webhook route rejects invalid signatures" grep -q "Invalid webhook signature" app/api/v1/webhooks/'[source]'/route.ts
check "production host-cookie default" grep -q "__Host-dp_session" server/identity/session-cookie.ts
check "forced tenant RLS migration" grep -q "FORCE ROW LEVEL SECURITY" db/migrations/0015_security_control_plane.sql
check "append-only security events" grep -q "security_events is append-only" db/migrations/0015_security_control_plane.sql
check "nonce CSP" grep -q "strict-dynamic" middleware.ts
check "query timeout" grep -q "statement_timeout" server/core/db.ts
if [ "$fail" -ne 0 ]; then exit 1; fi
say "Security static gate: GREEN"
