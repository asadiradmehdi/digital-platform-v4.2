-- Evidence that a customer accepted a given version of the terms: one row per (user, version), written when the
-- first session of that version is created (sign-up, SMS/Google/password sign-in on web or app).
CREATE TABLE IF NOT EXISTS terms_acceptances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  accepted_at   timestamptz NOT NULL DEFAULT now(),
  channel       text NOT NULL,
  auth_method   text,
  ip            inet,
  user_agent    text,
  UNIQUE (user_id, terms_version)
);
CREATE INDEX IF NOT EXISTS terms_acceptances_user_idx ON terms_acceptances(user_id, accepted_at DESC);
