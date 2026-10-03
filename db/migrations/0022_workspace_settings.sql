-- Adds a settings JSONB column to workspaces for admin-configurable
-- workspace metadata (e.g., locale, timezone, feature flags).
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';

-- Seed extended workspace and subscription permissions introduced
-- in post-v4 routes that were omitted from the initial permission seed.
INSERT INTO permissions(key, description) VALUES
  ('workspace.members.read',    'View workspace members'),
  ('workspace.members.manage',  'Add/remove workspace members and assign roles'),
  ('workspace.settings.manage', 'Update workspace name and settings'),
  ('subscriptions.cancel',      'Cancel workspace subscriptions')
ON CONFLICT(key) DO NOTHING;
