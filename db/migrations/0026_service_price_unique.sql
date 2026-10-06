-- Add unique constraint on service_prices for idempotent seed/upsert operations.
-- Only one active price per (service_id, currency) is allowed at a time.
CREATE UNIQUE INDEX IF NOT EXISTS service_prices_active_per_service_currency
  ON service_prices (service_id, currency)
  WHERE active = true;

-- Add description column to services for display.
ALTER TABLE services ADD COLUMN IF NOT EXISTS description text;
