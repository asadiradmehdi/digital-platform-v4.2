#!/bin/bash
# Runs each db/seeds/*.sql once (recorded as seed:<name> in schema_migrations), so later price edits
# made in the admin panel are never overwritten by a redeploy.
set -euo pipefail
: "${DATABASE_URL:?}"
for file in db/seeds/*.sql; do
  name="seed:$(basename "$file" .sql)"
  done_="$(psql "$DATABASE_URL" -Atqc "SELECT 1 FROM schema_migrations WHERE version='${name}'")"
  [[ "$done_" == "1" ]] && continue
  echo "Seeding $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qc "INSERT INTO schema_migrations(version) VALUES ('${name}')"
done
echo "SEEDS: GREEN"
