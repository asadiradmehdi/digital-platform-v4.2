BEGIN;

-- High-assurance authentication contracts. Secrets/credential material must never be stored raw.
CREATE TABLE IF NOT EXISTS authenticators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('PASSKEY','TOTP','RECOVERY')),
  credential_id_hash text UNIQUE,
  public_key text,
  sign_count bigint NOT NULL DEFAULT 0 CHECK(sign_count >= 0),
  label text,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_authenticators_user_active ON authenticators(user_id,revoked_at,created_at DESC);

CREATE TABLE IF NOT EXISTS trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_key_hash text NOT NULL UNIQUE,
  device_name text,
  platform text,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_active ON trusted_devices(user_id,revoked_at,last_seen_at DESC);

-- Server-side policy for high-risk actions. The mobile/web clients cannot lower these values.
CREATE TABLE IF NOT EXISTS transaction_security_policies (
  action_type text PRIMARY KEY,
  require_step_up boolean NOT NULL DEFAULT true,
  require_recent_auth_seconds integer NOT NULL DEFAULT 300 CHECK(require_recent_auth_seconds BETWEEN 30 AND 86400),
  max_amount_minor bigint CHECK(max_amount_minor IS NULL OR max_amount_minor >= 0),
  require_passkey boolean NOT NULL DEFAULT false,
  require_mfa boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO transaction_security_policies(action_type,require_step_up,require_recent_auth_seconds,require_passkey,require_mfa)
VALUES
 ('WALLET_WITHDRAW',true,300,true,true),
 ('PAYMENT_METHOD_CHANGE',true,300,false,true),
 ('API_KEY_CREATE',true,300,false,true),
 ('API_KEY_REVOKE',true,300,false,true),
 ('SECURITY_SETTINGS_CHANGE',true,300,false,true),
 ('WORKSPACE_OWNER_CHANGE',true,300,true,true)
ON CONFLICT(action_type) DO NOTHING;

-- Evidence that a sensitive action passed its server-side security policy.
CREATE TABLE IF NOT EXISTS security_action_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  challenge_id uuid REFERENCES security_challenges(id) ON DELETE SET NULL,
  authenticator_id uuid REFERENCES authenticators(id) ON DELETE SET NULL,
  correlation_id text NOT NULL,
  evidence_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_action_evidence_user_time ON security_action_evidence(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_action_evidence_workspace_time ON security_action_evidence(workspace_id,created_at DESC);

ALTER TABLE security_action_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_action_evidence FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS security_action_evidence_workspace_isolation ON security_action_evidence;
CREATE POLICY security_action_evidence_workspace_isolation ON security_action_evidence
  USING (workspace_id IS NULL OR workspace_id = app_workspace_id())
  WITH CHECK (workspace_id IS NULL OR workspace_id = app_workspace_id());

-- Sensitive security evidence is append-only.
CREATE OR REPLACE FUNCTION deny_security_action_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'security_action_evidence is append-only';
END $$;
DROP TRIGGER IF EXISTS trg_security_action_evidence_immutable ON security_action_evidence;
CREATE TRIGGER trg_security_action_evidence_immutable
BEFORE UPDATE OR DELETE ON security_action_evidence
FOR EACH ROW EXECUTE FUNCTION deny_security_action_evidence_mutation();

COMMIT;
