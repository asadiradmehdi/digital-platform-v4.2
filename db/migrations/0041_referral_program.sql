BEGIN;

-- «دعوت از دوستان»: a member shares a code; friends who sign up with it are attributed to them, and every
-- real (gateway-paid) wallet top-up by an attributed friend earns the member a share as wallet credit.
-- All rates, caps and windows live in referral_settings so the admin app can change them without a deploy;
-- none of them is shown to customers.
--
-- Money is wallet minor units (IRR), matching ledger_entries.
--
-- Tenancy:
--   referrals              one row per member (their code), owned by the member's workspace.
--   referral_attributions  one row per invited friend, owned by the friend's workspace and readable by the
--                          referrer's workspace (they see who joined through them, never the friend's data).
--   referral_rewards       owned by the workspace that is credited (the referrer, or the friend for the
--                          welcome gift).
-- Rows nobody can know the workspace of yet (code lookup at signup, the due-reward scan) are found through
-- the two narrow system_* functions below, following 0031.

CREATE TABLE IF NOT EXISTS referral_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  -- [{ "minActive": 1, "bps": 300 }, ...]: share in basis points by number of active friends.
  tiers jsonb NOT NULL DEFAULT '[{"minActive":0,"bps":300},{"minActive":5,"bps":500},{"minActive":20,"bps":700}]',
  welcome_bps integer NOT NULL DEFAULT 500 CHECK (welcome_bps BETWEEN 0 AND 10000),
  welcome_cap_minor bigint NOT NULL DEFAULT 500000 CHECK (welcome_cap_minor >= 0),
  hold_days integer NOT NULL DEFAULT 7 CHECK (hold_days BETWEEN 0 AND 90),
  attribution_months integer NOT NULL DEFAULT 12 CHECK (attribution_months BETWEEN 1 AND 120),
  monthly_cap_minor bigint NOT NULL DEFAULT 20000000 CHECK (monthly_cap_minor >= 0),
  -- More friends than this from one network address puts new sign-ups on review instead of earning.
  max_signups_per_ip integer NOT NULL DEFAULT 3 CHECK (max_signups_per_ip >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid REFERENCES users(id)
);
INSERT INTO referral_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- referrals (0003) gains its owner workspace and one code per member.
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS creator_ip_hash text;
DELETE FROM referrals WHERE workspace_id IS NULL;
ALTER TABLE referrals ALTER COLUMN workspace_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS referrals_one_per_user ON referrals(referrer_user_id);

-- referral_attributions (0003): one per friend, with the referrer's workspace for crediting.
DELETE FROM referral_attributions WHERE workspace_id IS NULL OR referred_user_id IS NULL;
ALTER TABLE referral_attributions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE referral_attributions ALTER COLUMN referred_user_id SET NOT NULL;
ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS referrer_workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('ACTIVE','REVIEW','BLOCKED'));
ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS signup_ip_hash text;
ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS first_topup_at timestamptz;
ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
DELETE FROM referral_attributions WHERE referrer_workspace_id IS NULL;
ALTER TABLE referral_attributions ALTER COLUMN referrer_workspace_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS referral_attributions_one_per_friend ON referral_attributions(referred_user_id);
CREATE INDEX IF NOT EXISTS referral_attributions_referrer ON referral_attributions(referrer_workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  attribution_id uuid NOT NULL REFERENCES referral_attributions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('REFERRER_SHARE','WELCOME_GIFT')),
  source_payment_id uuid NOT NULL,
  source_amount_minor bigint NOT NULL CHECK (source_amount_minor > 0),
  rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  credited_minor bigint NOT NULL DEFAULT 0 CHECK (credited_minor >= 0),
  currency char(3) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CREDITED','REVERSED','CAPPED')),
  available_at timestamptz NOT NULL,
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_payment_id, kind)
);
CREATE INDEX IF NOT EXISTS referral_rewards_due ON referral_rewards(available_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS referral_rewards_ws ON referral_rewards(workspace_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['referrals','referral_attributions','referral_rewards']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (workspace_id = app_workspace_id()) WITH CHECK (workspace_id = app_workspace_id())', t);
  END LOOP;
END $$;

-- The referrer's workspace may read the attributions that point at it (to count and list its friends).
DROP POLICY IF EXISTS referrer_read ON referral_attributions;
CREATE POLICY referrer_read ON referral_attributions FOR SELECT
  USING (referrer_workspace_id = app_workspace_id());

-- System reads (0031 pattern): SELECT only, open only inside the functions below.
DROP POLICY IF EXISTS system_read ON referrals;
CREATE POLICY system_read ON referrals FOR SELECT USING (app_system_read());
DROP POLICY IF EXISTS system_read ON referral_rewards;
CREATE POLICY system_read ON referral_rewards FOR SELECT USING (app_system_read());

-- Signup: resolve an invite code to its owner. Returns at most one active row.
CREATE OR REPLACE FUNCTION system_find_referral_by_code(p_code text)
RETURNS TABLE(referral_id uuid, referrer_user_id uuid, workspace_id uuid, creator_ip_hash text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT r.id, r.referrer_user_id, r.workspace_id, r.creator_ip_hash
      FROM referrals r WHERE r.code = upper(p_code) AND r.active LIMIT 1;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Release scan: pending rewards whose hold has passed (routing data only).
CREATE OR REPLACE FUNCTION system_due_referral_rewards(p_limit integer)
RETURNS TABLE(reward_id uuid, workspace_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT w.id, w.workspace_id FROM referral_rewards w
     WHERE w.status = 'PENDING' AND w.available_at <= now()
     ORDER BY w.available_at LIMIT LEAST(GREATEST(p_limit, 1), 500);
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Signup: how many friends of this referrer already joined from the same network address (a count only).
DROP POLICY IF EXISTS system_read ON referral_attributions;
CREATE POLICY system_read ON referral_attributions FOR SELECT USING (app_system_read());
CREATE OR REPLACE FUNCTION system_referral_ip_signups(p_referrer_workspace_id uuid, p_ip_hash text)
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE prev text := current_setting('app.rls_system_read', true); n bigint;
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  SELECT count(*) INTO n FROM referral_attributions a
   WHERE a.referrer_workspace_id = p_referrer_workspace_id AND a.signup_ip_hash = p_ip_hash;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION system_find_referral_by_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_referral_ip_signups(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_due_referral_rewards(integer) FROM PUBLIC;

COMMIT;
