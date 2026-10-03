-- Agency/client workspace hierarchy and white-label branding.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS parent_workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workspace_type text NOT NULL DEFAULT 'standard' CHECK(workspace_type IN ('standard','agency','client'));

CREATE INDEX IF NOT EXISTS idx_workspaces_parent ON workspaces(parent_workspace_id) WHERE parent_workspace_id IS NOT NULL;

-- White-label branding configuration per workspace.
CREATE TABLE IF NOT EXISTS workspace_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  display_name text,
  logo_url text,
  favicon_url text,
  primary_color char(7),
  custom_domain text UNIQUE,
  support_email text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
