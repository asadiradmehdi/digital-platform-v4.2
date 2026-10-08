BEGIN;

-- What a gateway payment pays for. Before this, a payment without order_id was always treated as a
-- wallet top-up, so a paid checkout (plan or coupon purchase) was credited to the wallet instead of
-- being delivered, and a gateway-paid order also debited the wallet a second time.
--
--   ORDER    — pays orders.id (order_id); the wallet is never touched.
--   CHECKOUT — pays checkout_sessions.id (checkout_session_id); the session is fulfilled on payment.
--   TOPUP    — credits the workspace wallet, converted into the wallet currency.
--
-- No backfill: payments is FORCE ROW LEVEL SECURITY and migrations run as the non-superuser owner,
-- so an UPDATE here would silently touch nothing. NULL (rows written before this migration) is read
-- by the application as ORDER when order_id is set and TOPUP otherwise, which is the old behaviour.
-- ADD COLUMN and CHECK validation are catalog/scan operations and are not filtered by RLS.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_session_id uuid REFERENCES checkout_sessions(id);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments ADD CONSTRAINT payments_purpose_check CHECK (
  purpose IS NULL
  OR (purpose = 'ORDER' AND order_id IS NOT NULL AND checkout_session_id IS NULL)
  OR (purpose = 'CHECKOUT' AND checkout_session_id IS NOT NULL)
  OR (purpose = 'TOPUP' AND order_id IS NULL AND checkout_session_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_payments_checkout_session ON payments(checkout_session_id) WHERE checkout_session_id IS NOT NULL;

COMMIT;
