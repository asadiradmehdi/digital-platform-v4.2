BEGIN;

-- Tenant context is transaction-local. Application code must set it before touching tenant-scoped data.
CREATE OR REPLACE FUNCTION app_set_workspace_context(p_workspace_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace context is required';
  END IF;
  PERFORM set_config('app.workspace_id', p_workspace_id::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION app_workspace_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app_is_workspace_member(p_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.status = 'ACTIVE'
      AND wm.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );
$$;

-- High-risk tenant tables. RLS is deliberately enforced at the database boundary.
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_workspace_isolation ON wallets;
CREATE POLICY wallet_workspace_isolation ON wallets
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orders_workspace_isolation ON orders;
CREATE POLICY orders_workspace_isolation ON orders
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_keys_workspace_isolation ON api_keys;
CREATE POLICY api_keys_workspace_isolation ON api_keys
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

ALTER TABLE api_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_usage_workspace_isolation ON api_usage_events;
CREATE POLICY api_usage_workspace_isolation ON api_usage_events
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

-- Distributed abuse controls. Counters are atomic and survive multi-instance deployments.
CREATE TABLE IF NOT EXISTS abuse_rate_buckets (
  bucket_key text NOT NULL,
  scope text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK(request_count >= 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(bucket_key, scope, window_started_at)
);
CREATE INDEX IF NOT EXISTS idx_abuse_rate_buckets_expiry ON abuse_rate_buckets(expires_at);

CREATE OR REPLACE FUNCTION consume_rate_limit(
  p_bucket_key text,
  p_scope text,
  p_window_seconds integer,
  p_max_requests integer
)
RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql AS $$
DECLARE
  v_start timestamptz;
  v_count integer;
BEGIN
  IF p_window_seconds <= 0 OR p_max_requests <= 0 THEN
    RAISE EXCEPTION 'invalid rate limit configuration';
  END IF;
  v_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);
  INSERT INTO abuse_rate_buckets(bucket_key,scope,window_started_at,request_count,expires_at)
  VALUES(p_bucket_key,p_scope,v_start,1,v_start + make_interval(secs => p_window_seconds))
  ON CONFLICT(bucket_key,scope,window_started_at)
  DO UPDATE SET request_count = abuse_rate_buckets.request_count + 1
  RETURNING request_count INTO v_count;
  RETURN QUERY SELECT v_count <= p_max_requests,
    GREATEST(p_max_requests - v_count, 0),
    v_start + make_interval(secs => p_window_seconds);
END;
$$;

-- Keep abuse counters bounded without coupling them to business data.
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_status ON api_keys(workspace_id,revoked_at,expires_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_workspace_time ON api_usage_events(workspace_id,created_at DESC);

-- Backup metadata makes restore evidence auditable without storing backup bytes in PostgreSQL.
CREATE TABLE IF NOT EXISTS backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL,
  backup_type text NOT NULL CHECK(backup_type IN ('FULL','SCHEMA','WAL','SNAPSHOT')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL CHECK(status IN ('RUNNING','SUCCEEDED','FAILED','VERIFIED')),
  object_uri text,
  bytes bigint CHECK(bytes IS NULL OR bytes >= 0),
  checksum_sha256 text,
  restore_verified_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_backup_runs_env_time ON backup_runs(environment,started_at DESC);

COMMIT;
