-- Migration: 0023_notifications_read
-- Adds read_at column to notifications table and an index for efficient unread queries.
BEGIN;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

COMMIT;
