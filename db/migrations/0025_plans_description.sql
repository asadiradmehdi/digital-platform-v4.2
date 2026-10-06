-- Add description column to plans table for display in pricing/subscription UIs.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS description text;
