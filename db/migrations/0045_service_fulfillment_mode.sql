-- How a paid order for a service is fulfilled.
--   PROVIDER: routed to an external provider (default; the existing social-growth flow).
--   MANUAL:   fulfilled by the ZOHALPAY team (design, automation, AI content, AI subscriptions). The outbox
--             queues the paid order for the team instead of calling a provider, so it never fails for lack
--             of a provider route.
-- services is a platform catalogue table (no workspace_id), so no RLS policy is involved.
ALTER TABLE services ADD COLUMN IF NOT EXISTS fulfillment_mode text NOT NULL DEFAULT 'PROVIDER';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_fulfillment_mode_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_fulfillment_mode_check CHECK (fulfillment_mode IN ('PROVIDER', 'MANUAL'));
  END IF;
END $$;
