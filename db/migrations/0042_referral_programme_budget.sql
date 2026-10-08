BEGIN;
-- Programme-wide monthly budget for referrer shares (wallet minor units, IRR); 0 = no programme cap.
-- Set from the admin app; shares that would exceed it are marked CAPPED instead of being credited.
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS programme_monthly_budget_minor bigint NOT NULL DEFAULT 0
  CHECK (programme_monthly_budget_minor >= 0);

-- Sum of shares credited this month across every workspace (one number, no row data).
CREATE OR REPLACE FUNCTION system_referral_month_spend()
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE prev text := current_setting('app.rls_system_read', true); n bigint;
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  SELECT COALESCE(sum(credited_minor), 0) INTO n FROM referral_rewards
   WHERE kind = 'REFERRER_SHARE' AND credited_at >= date_trunc('month', now());
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION system_referral_month_spend() FROM PUBLIC;
COMMIT;
