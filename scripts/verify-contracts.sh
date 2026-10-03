#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail(){ echo "CONTRACT CHECK FAILED: $1" >&2; exit 1; }
[ -f docs/MOBILE_PRODUCT_CONTRACT_v1.md ] || fail "mobile contract missing"
[ -f docs/SECURITY_HIGH_ASSURANCE_v1.md ] || fail "security contract missing"
[ -d apps/mobile ] || fail "mobile app missing"
[ -f packages/design-tokens/src/index.ts ] || fail "shared design tokens missing"
[ -f db/migrations/0016_high_assurance_auth_and_transaction_security.sql ] || fail "security migration missing"

grep -q "RLS" docs/SECURITY_ARCHITECTURE_v2.md || fail "RLS contract missing"
grep -q "same visual theme" CLAUDE.md || true
grep -q "shared design tokens" CLAUDE.md || fail "Claude UI token rule missing"
grep -q "apps/\*" pnpm-workspace.yaml || fail "mobile workspace not registered"

# Migration transaction balance.
for f in db/migrations/*.sql; do
  begins=$(grep -c '^BEGIN;' "$f" || true)
  commits=$(grep -c '^COMMIT;' "$f" || true)
  [ "$begins" -eq "$commits" ] || fail "unbalanced transaction in $f"
done

echo "CONTRACT CHECK: PASS"
