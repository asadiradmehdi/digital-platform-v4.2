BEGIN;

-- «فاکتورها»: every successful customer payment issues exactly one document, in the same transaction
-- that records the payment.
--   SALE           a sales invoice (service order, subscription), amounts in toman (IRT).
--   TOPUP_RECEIPT  «رسید شارژ کیف پول»: money received into the wallet. Not a sale, never carries VAT.
--
-- Prices shown to customers are final (tax-inclusive). When VAT is enabled the invoice breaks out the
-- VAT portion that is already inside the total: vat = floor(total × rate / (1 + rate)), in whole toman.
-- While the business is not registered with سامانه مؤدیان, vat_enabled stays false and invoices make no
-- tax claim at all (vat_minor = 0, vat_rate_bps NULL).

-- 1) Platform-level seller identity and tax switch (one row, edited later from the admin app).
--    Empty strings mean «not provided yet»; the invoice hides empty fields.
CREATE TABLE IF NOT EXISTS invoice_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  seller_legal_name text NOT NULL DEFAULT '',
  seller_national_id text NOT NULL DEFAULT '',
  seller_economic_code text NOT NULL DEFAULT '',
  seller_address text NOT NULL DEFAULT '',
  seller_postal_code text NOT NULL DEFAULT '',
  seller_phone text NOT NULL DEFAULT '',
  vat_enabled boolean NOT NULL DEFAULT false,
  vat_rate_bps integer NOT NULL DEFAULT 1000 CHECK (vat_rate_bps BETWEEN 0 AND 10000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid REFERENCES users(id)
);
INSERT INTO invoice_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2) Invoice document fields. Seller and buyer are snapshots taken at issue time, so a later profile or
--    settings change never rewrites an issued document.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'SALE';
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_document_type_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_document_type_check CHECK (document_type IN ('SALE','TOPUP_RECEIPT'));
-- Idempotency key of the issuing event: 'order:<id>', 'payment:<id>' or 'subscription:<id>'.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_minor bigint NOT NULL DEFAULT 0;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_vat_minor_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_vat_minor_check CHECK (vat_minor >= 0 AND vat_minor <= total_minor);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_rate_bps integer;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_vat_rate_bps_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_vat_rate_bps_check CHECK (vat_rate_bps IS NULL OR vat_rate_bps BETWEEN 0 AND 10000);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_name text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_phone text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_email text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS seller_snapshot jsonb NOT NULL DEFAULT '{}';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_payment_method_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('WALLET','GATEWAY'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Lines keep the order they were written in (ids are random uuids).
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS line_no integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_source ON invoices(workspace_id, source_key) WHERE source_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_payment ON invoices(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_ws_issued ON invoices(workspace_id, issued_at DESC, id DESC);

-- invoices keeps FORCE RLS with tenant_isolation (0015); re-asserted here for this table's new use.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON invoices;
CREATE POLICY tenant_isolation ON invoices USING (workspace_id = app_workspace_id()) WITH CHECK (workspace_id = app_workspace_id());

-- invoice_items has no workspace column: a line is visible and writable only through an invoice row the
-- current tenant can see (the subquery is itself filtered by the invoices policy).
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_items_via_invoice ON invoice_items;
CREATE POLICY invoice_items_via_invoice ON invoice_items
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id));

-- 3) Invoice numbers: one sequence per year (0019 created 2026–2030). Years ahead are created here so the
--    numbering function never needs DDL inside a payment transaction for the next decade.
DO $$
DECLARE y int;
BEGIN
  FOR y IN 2026..2040 LOOP
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS invoice_number_seq_%s START 1 INCREMENT 1 MINVALUE 1', y);
  END LOOP;
END $$;

-- «INV-2026-000123». Falls back to creating the year's sequence if it is missing (after 2040).
CREATE OR REPLACE FUNCTION app_next_invoice_number(p_year int) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE seq_name text := 'invoice_number_seq_' || p_year::text;
BEGIN
  IF p_year < 2000 OR p_year > 2999 THEN RAISE EXCEPTION 'invalid invoice year %', p_year; END IF;
  IF to_regclass(seq_name) IS NULL THEN
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START 1 INCREMENT 1 MINVALUE 1', seq_name);
  END IF;
  RETURN 'INV-' || p_year::text || '-' || lpad(nextval(seq_name)::text, 6, '0');
END $$;

COMMIT;
