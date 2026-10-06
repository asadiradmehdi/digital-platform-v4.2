-- Migration: 0024_notification_preferences
-- Stores per-user notification channel and category preferences.
BEGIN;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel, category)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user
  ON notification_preferences(user_id);

COMMIT;
