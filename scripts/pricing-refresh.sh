#!/usr/bin/env bash
set -euo pipefail
: "${APP_URL:?APP_URL is required}"
: "${PRICING_CRON_SECRET:?PRICING_CRON_SECRET is required}"
curl --fail-with-body -sS -X POST "$APP_URL/api/internal/pricing/refresh" \
  -H "Authorization: Bearer $PRICING_CRON_SECRET" \
  -H "Content-Type: application/json"
printf '\n'
