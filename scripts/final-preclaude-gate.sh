#!/usr/bin/env bash
set -euo pipefail
./scripts/verify-contracts.sh
./scripts/verify-foundation.sh
./scripts/verify-rls-boundaries.sh
./scripts/verify-visual-parity.sh
./scripts/security-stage-gate.sh
grep -q "requireRequestUser" server/identity/request-user.ts
grep -q "setSessionCookie(response, token)" app/api/v1/auth/login/route.ts
grep -q "setSessionCookie(response, token)" app/api/v1/auth/register/route.ts
grep -q "requireRequestUser(request)" app/api/v1/notifications/route.ts
grep -q "requireRequestUser(request)" app/api/v1/subscriptions/route.ts
test -f app/api/v1/analytics/route.ts
test -f app/support/new/page.tsx
test -f docs/PRE_CLAUDE_RUNTIME_BLOCKERS_v1.md
printf '%s\n' 'FINAL_PRECLAUDE_STATIC_GATE=PASS'
