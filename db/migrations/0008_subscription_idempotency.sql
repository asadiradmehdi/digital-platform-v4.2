BEGIN;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS ux_subscriptions_workspace_idempotency
  ON subscriptions(workspace_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;
COMMIT;
