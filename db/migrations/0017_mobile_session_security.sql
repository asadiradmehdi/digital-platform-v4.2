BEGIN;

-- Mobile sessions reuse the same server-side session authority while recording device context.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'WEB'
  CHECK (client_type IN ('WEB','PWA','IOS','ANDROID'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_id_hash text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS platform_version text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_ip inet;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_user_agent text;

CREATE INDEX IF NOT EXISTS idx_sessions_user_client_active
  ON sessions(user_id, client_type, revoked_at, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_device_active
  ON sessions(user_id, device_id_hash, revoked_at, expires_at DESC);

-- A device identifier is pseudonymous and must never be stored raw.
CREATE TABLE IF NOT EXISTS mobile_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  platform text,
  device_id_hash text,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobile_security_events_user_time
  ON mobile_security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mobile_security_events_device_time
  ON mobile_security_events(device_id_hash, created_at DESC);

COMMIT;
