#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
: "${DATABASE_URL:?DATABASE_URL is required}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0000_migration_meta.sql >/dev/null
for file in db/migrations/*.sql; do
  version="$(basename "$file" .sql)"
  [[ "$version" == "0000_migration_meta" ]] && continue
  applied="$(psql "$DATABASE_URL" -Atqc "SELECT 1 FROM schema_migrations WHERE version='${version}' LIMIT 1")"
  if [[ "$applied" == "1" ]]; then echo "Skipping $version"; continue; fi
  echo "Applying $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations(version) VALUES ('$version')"
done
echo "MIGRATIONS: GREEN"
