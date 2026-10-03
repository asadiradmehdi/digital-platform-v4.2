BEGIN;

-- Security events are append-only application evidence. Never store raw credentials, tokens or secrets here.
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('INFO','WARNING','HIGH','CRITICAL')),
  correlation_id text,
  source_ip inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_events_user_time ON security_events(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_workspace_time ON security_events(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type_time ON security_events(event_type,created_at DESC);

CREATE TABLE IF NOT EXISTS account_security_state (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until timestamptz,
  last_failed_at timestamptz,
  last_success_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Step-up authentication contract for money movement and privileged operations.
CREATE TABLE IF NOT EXISTS security_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  challenge_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_challenges_user_time ON security_challenges(user_id,expires_at DESC);

-- Strong password policy metadata; enforcement remains at the application boundary.
CREATE TABLE IF NOT EXISTS password_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  min_length integer NOT NULL CHECK(min_length >= 12),
  require_upper boolean NOT NULL DEFAULT true,
  require_lower boolean NOT NULL DEFAULT true,
  require_digit boolean NOT NULL DEFAULT true,
  require_symbol boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO password_policy_versions(version,min_length,require_upper,require_lower,require_digit,require_symbol,active)
VALUES(1,14,true,true,true,true,true)
ON CONFLICT(version) DO NOTHING;

-- Additional financial tables are deny-by-default under an explicit transaction tenant context.
-- Application code must use a tenant transaction before querying these tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ledger_transactions','payments','invoices','subscriptions','checkout_sessions','ai_cost_events','ai_requests','ai_usage_events','usage_events','usage_counters','coupon_redemptions','commissions','risk_events','operational_events','agent_runs','workflow_runs','notifications','support_tickets','audit_logs']
  LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
      EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (workspace_id = app_workspace_id()) WITH CHECK (workspace_id = app_workspace_id())', t);
    END IF;
  END LOOP;
END $$;

-- Prevent direct mutation/deletion of security evidence by ordinary application paths.
CREATE OR REPLACE FUNCTION deny_security_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'security_events is append-only';
END $$;
DROP TRIGGER IF EXISTS trg_security_events_immutable ON security_events;
CREATE TRIGGER trg_security_events_immutable
BEFORE UPDATE OR DELETE ON security_events
FOR EACH ROW EXECUTE FUNCTION deny_security_event_mutation();

COMMIT;
