#!/usr/bin/env bash
set -euo pipefail
# Static guard: known tenant-scoped code must use a workspace transaction.
# Runtime PostgreSQL tests remain mandatory and are the final authority.
fail=0
for file in server/commerce/orders.ts server/commerce/checkout.ts server/subscriptions/service.ts server/subscriptions/usage.ts server/ai/usage.ts server/analytics/events.ts server/billing/journal.ts server/billing/double-entry.ts server/billing/ledger.ts server/payments/service.ts server/queue/order-worker.ts; do
  if grep -q 'withTransaction' "$file"; then
    echo "RLS_BOUNDARY_FAIL: $file still references withTransaction"
    fail=1
  fi
done
if grep -RInE 'FROM (orders|payments|subscriptions|checkout_sessions|ai_usage_events|usage_events|usage_counters|ledger_transactions|wallets|api_keys)' server --include='*.ts' | grep -q 'query('; then
  echo "RLS_BOUNDARY_REVIEW: direct query() references tenant-protected tables require manual/runtime review"
fi
if [ "$fail" -ne 0 ]; then exit 1; fi
echo 'RLS_BOUNDARY_STATIC=PASS'
