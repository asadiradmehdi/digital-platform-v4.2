#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
TEST_DB="${RESTORE_TEST_DB:-platform_restore_verify}"
ADMIN_URL="${DATABASE_URL%/*}"
psql "$ADMIN_URL/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$TEST_DB\"" -c "CREATE DATABASE \"$TEST_DB\""
TEST_URL="${ADMIN_URL}/${TEST_DB}"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$TEST_URL" "$BACKUP_FILE"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -c "SELECT count(*) AS users FROM users" -c "SELECT count(*) AS workspaces FROM workspaces"
psql "$ADMIN_URL/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE \"$TEST_DB\""
printf 'Restore verification PASS\n'
