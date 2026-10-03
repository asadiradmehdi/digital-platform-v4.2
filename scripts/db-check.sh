#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user, version();' >/dev/null
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 
echo "DB CHECK: GREEN"
