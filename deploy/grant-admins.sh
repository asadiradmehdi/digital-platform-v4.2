#!/bin/bash
# Idempotent: gives each email in deploy/admins.txt the global platform_admin role through its first
# ACTIVE workspace membership. Runs as the database owner (global roles are operator-provisioned only).
set -euo pipefail
cd "$(dirname "$0")"
grep -vE '^\s*(#|$)' admins.txt | while read -r email; do
  [[ "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]] || { echo "skip invalid: $email"; continue; }
  docker compose exec -T db psql -U postgres -d zohalpay -v ON_ERROR_STOP=1 -q -v email="$email" <<'SQL'
INSERT INTO roles(workspace_id, name, is_system)
SELECT NULL, 'platform_admin', true
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE workspace_id IS NULL AND name = 'platform_admin');
INSERT INTO member_roles(member_id, role_id)
SELECT wm.id, r.id
FROM users u
JOIN LATERAL (SELECT id FROM workspace_members WHERE user_id = u.id AND status = 'ACTIVE' ORDER BY created_at LIMIT 1) wm ON true
JOIN roles r ON r.workspace_id IS NULL AND r.name = 'platform_admin' AND r.is_system = true
WHERE lower(u.email) = lower(:'email')
ON CONFLICT DO NOTHING;
SQL
done
