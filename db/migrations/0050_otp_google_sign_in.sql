-- Migration: 0050_otp_google_sign_in
-- Phone + one-time-code sign-in, Google sign-in, platform provider settings and the session lifetime policy.
-- None of these tables carries a workspace_id: they are account/platform scoped (like users and sessions),
-- so tenant RLS does not apply. They never hold a plaintext code, token or secret.
BEGIN;

-- 1) Verified contact points. A phone or email typed into a profile is only a claim until it is proven;
--    sign-in may only ever match a VERIFIED phone/email, otherwise anyone could pre-claim a victim's
--    number and later receive their sign-in (account pre-hijacking). Existing values stay unverified.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

-- 2) Session lifetime: sliding idle expiry (expires_at, pushed forward on use) under a hard absolute cap.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS absolute_expires_at timestamptz;
UPDATE sessions SET absolute_expires_at = LEAST(expires_at, created_at + interval '30 days') WHERE absolute_expires_at IS NULL;
ALTER TABLE sessions ALTER COLUMN absolute_expires_at SET DEFAULT now() + interval '30 days';
ALTER TABLE sessions ALTER COLUMN absolute_expires_at SET NOT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_method text
  CHECK (auth_method IS NULL OR auth_method IN ('PASSWORD','OTP','GOOGLE','MFA','PASSKEY'));

-- 3) One-time codes. code_hash is an HMAC keyed by a server secret (a 6-digit space is trivially
--    brute-forced from a bare hash). A successful REAUTH / PHONE_CHANGE verification mints a short-lived,
--    single-use proof (proof_hash) that a sensitive endpoint must present.
CREATE TABLE IF NOT EXISTS otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL CHECK (purpose IN ('LOGIN','REAUTH','PHONE_CHANGE')),
  phone text NOT NULL CHECK (phone ~ '^\+989[0-9]{9}$'),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  locked_at timestamptz,
  superseded_at timestamptz,
  proof_hash text UNIQUE,
  proof_expires_at timestamptz,
  proof_used_at timestamptz,
  ip_hash text,
  client text NOT NULL DEFAULT 'WEB' CHECK (client IN ('WEB','MOBILE')),
  delivery_status text NOT NULL DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING','SENT','FAILED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_phone_recent ON otp_challenges(phone, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_user ON otp_challenges(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- 4) External identities (Google). The subject (sub) is the stable key; email is informational.
CREATE TABLE IF NOT EXISTS user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google')),
  subject text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (provider, subject),
  UNIQUE (user_id, provider)
);

-- 5) OAuth authorization-code flows in flight (state/nonce/PKCE), bound to the starting browser by a
--    cookie whose hash is stored here. The PKCE verifier is encrypted at rest (secret-box).
CREATE TABLE IF NOT EXISTS oauth_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('google')),
  state_hash text NOT NULL UNIQUE,
  binding_hash text NOT NULL,
  nonce text NOT NULL,
  code_verifier_ciphertext text NOT NULL,
  client text NOT NULL CHECK (client IN ('WEB','MOBILE')),
  app_challenge text,
  next_path text,
  referral_code text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Mobile hand-off: the browser leg ends in a deep link carrying a one-time code that the app redeems,
-- together with the verifier of the app_challenge it opened the flow with (protects against another
-- app registering the same URL scheme and catching the redirect).
CREATE TABLE IF NOT EXISTS oauth_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_challenge text NOT NULL,
  account_created boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6) Platform-level settings edited later from the admin app (SMS / Google credentials). Secrets live
--    only in secret_ciphertext (AES-256-GCM via SECRETS_MASTER_KEY); value holds non-secret config.
CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_.]{1,63}$'),
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ciphertext text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

COMMIT;
