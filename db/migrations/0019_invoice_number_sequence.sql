-- Annual invoice number sequence, created per-year.
-- The application creates the sequence for the current year on first use.
-- This migration pre-creates sequences for the near-term years to avoid
-- a race condition on first invoice generation.

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq_2026 START 1 INCREMENT 1 MINVALUE 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq_2027 START 1 INCREMENT 1 MINVALUE 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq_2028 START 1 INCREMENT 1 MINVALUE 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq_2029 START 1 INCREMENT 1 MINVALUE 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq_2030 START 1 INCREMENT 1 MINVALUE 1;

-- Ensure the invoices table has all columns added in 0011.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_minor bigint NOT NULL DEFAULT 0 CHECK(discount_minor >= 0);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
