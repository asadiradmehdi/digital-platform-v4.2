BEGIN;

-- «تیم و دسترسی‌ها»: staff the owner adds under himself, each with exactly the permissions he chose.
-- The owner is the platform_admin role holder (deploy/admins.txt) and keeps every permission implicitly; he is NOT a row here.
-- Platform data, not tenant data (no workspace_id): written and read only by admin code, every change audited.
--   parent_user_id  who this person works under (the owner or another staff member who added them); managers only see/edit their subtree
--   permissions     keys from lib/admin-permissions.ts; unknown keys are rejected by the server, never trusted from the client
CREATE TABLE IF NOT EXISTS staff_members (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  parent_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED')),
  title text CHECK (title IS NULL OR char_length(title) <= 60),
  preset text CHECK (preset IS NULL OR char_length(preset) <= 40),
  permissions text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_user_id IS NULL OR parent_user_id <> user_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_members_parent ON staff_members(parent_user_id);

-- Invitation for someone without an account yet: the first verified sign-in with this email/phone claims it.
CREATE TABLE IF NOT EXISTS staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_kind text NOT NULL CHECK (contact_kind IN ('email','phone')),
  contact_value text NOT NULL CHECK (char_length(contact_value) BETWEEN 3 AND 200),
  parent_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text CHECK (title IS NULL OR char_length(title) <= 60),
  preset text,
  permissions text[] NOT NULL DEFAULT '{}',
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  claimed_at timestamptz,
  claimed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_invites_open ON staff_invites(contact_kind, lower(contact_value)) WHERE claimed_at IS NULL AND revoked_at IS NULL;

COMMIT;
