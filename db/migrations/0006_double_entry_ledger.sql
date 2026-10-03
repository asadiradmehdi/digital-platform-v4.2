BEGIN;
CREATE TABLE IF NOT EXISTS ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  currency char(3) NOT NULL,
  reference_type text NOT NULL,
  reference_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ledger_transaction_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ledger_accounts(id),
  direction ledger_direction NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor > 0),
  UNIQUE(transaction_id, account_id, direction)
);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_workspace_time ON ledger_transactions(workspace_id, created_at DESC);

-- The application must post a complete journal atomically. This deferred trigger prevents
-- committed transactions whose debit/credit totals do not balance.
CREATE OR REPLACE FUNCTION assert_ledger_transaction_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE debit_total bigint; credit_total bigint;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN direction='DEBIT' THEN amount_minor ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_minor ELSE 0 END),0)
    INTO debit_total, credit_total
    FROM ledger_transaction_entries WHERE transaction_id=NEW.transaction_id;
  IF debit_total <> credit_total OR debit_total = 0 THEN RAISE EXCEPTION 'Ledger transaction % is not balanced', NEW.transaction_id; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ledger_transaction_balanced ON ledger_transaction_entries;
CREATE CONSTRAINT TRIGGER trg_ledger_transaction_balanced
AFTER INSERT OR UPDATE ON ledger_transaction_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_ledger_transaction_balanced();
COMMIT;
