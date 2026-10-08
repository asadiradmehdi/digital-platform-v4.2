-- Migration: 0051_customer_messaging
-- Customer messaging: order lifecycle and invoice events captured at the database edge, an SMS outbox drained
-- by a worker outside any request transaction, and the inbound «استعلام وضعیت با پیامک» lookup.
BEGIN;

-- 1) Lifecycle events. Written by the orders trigger (and the invoice hook) in the same transaction as the status
--    change, so a message is never announced for a change that rolled back, and no order code has
--    to remember to call the notifier. The workspace id travels in the payload (system queue, read only by
--    the internal worker, like outbox_events); the worker does the per-tenant work in a tenant transaction.
CREATE TABLE IF NOT EXISTS customer_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_id uuid NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_message_events_pending
  ON customer_message_events(created_at) WHERE processed_at IS NULL;

CREATE OR REPLACE FUNCTION capture_order_message_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  kind := CASE
    WHEN NEW.status IN ('PAID','QUEUED') THEN 'order.registered'
    WHEN NEW.status IN ('PROCESSING','PROVIDER_SUBMITTED','IN_PROGRESS') THEN 'order.started'
    WHEN NEW.status = 'COMPLETED' THEN 'order.completed'
    WHEN NEW.status IN ('FAILED','CANCELLED') THEN 'order.stopped'
    WHEN NEW.status = 'REFUNDED' THEN 'order.refunded'
    ELSE NULL END;
  IF kind IS NULL THEN RETURN NEW; END IF;
  -- Capturing a message must never fail the order transaction.
  BEGIN
    INSERT INTO customer_message_events(event_type, entity_id, dedupe_key, payload)
    VALUES (kind, NEW.id, kind || ':' || NEW.id::text,
            jsonb_build_object('workspaceId', NEW.workspace_id, 'orderId', NEW.id, 'status', NEW.status))
    ON CONFLICT (dedupe_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'customer message capture failed for order %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_customer_message ON orders;
CREATE TRIGGER trg_orders_customer_message
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION capture_order_message_event();

-- Payment receipts are not captured here: every successful payment issues an invoice, and the invoice
-- hook (server/payments/invoice-notify.ts → queueInvoiceReceiptSms) writes an 'invoice.issued' event in
-- the payment transaction. The in-app entry for it is written by the invoices module itself.

-- 2) SMS outbox. Provider calls happen only in the worker, never inside a request/DB transaction.
--    `template` names a configured pattern; args are the pattern variables (never a code for LOGIN: OTPs
--    are sent synchronously and never queued, so no plaintext code is ever persisted).
CREATE TABLE IF NOT EXISTS sms_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template text NOT NULL CHECK (template IN ('order_registered','order_completed','payment_receipt','status_reply')),
  to_phone text NOT NULL CHECK (to_phone ~ '^\+989[0-9]{9}$'),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  args jsonb NOT NULL DEFAULT '[]'::jsonb,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENDING','SENT','FAILED','SKIPPED')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_reference text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sms_outbox_due ON sms_outbox(next_attempt_at) WHERE status IN ('PENDING','SENDING');

-- 3) Inbound SMS evidence: no message body and no raw number are stored (keyed hash only).
CREATE TABLE IF NOT EXISTS inbound_sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_message_id text,
  from_hash text,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_message_id)
);

-- 4) «استعلام وضعیت با پیامک»: locate an order by its public code prefix, but only for a sender whose
--    VERIFIED phone belongs to an active member of the order's workspace. Routing data only; the caller
--    reads the status inside withTenantTransaction(workspace_id). Same system_read pattern as 0031/0041.
CREATE OR REPLACE FUNCTION system_find_order_for_phone(p_prefix text, p_phone text)
RETURNS TABLE(order_id uuid, workspace_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  IF p_prefix !~ '^[0-9a-fA-F]{6}$' OR p_phone !~ '^\+989[0-9]{9}$' THEN RETURN; END IF;
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT o.id, o.workspace_id
      FROM orders o
      JOIN workspace_members wm ON wm.workspace_id = o.workspace_id AND wm.status = 'ACTIVE'
      JOIN users u ON u.id = wm.user_id AND u.phone = p_phone AND u.phone_verified_at IS NOT NULL AND u.status = 'ACTIVE'
     WHERE replace(o.id::text, '-', '') LIKE lower(p_prefix) || '%'
     ORDER BY o.created_at DESC
     LIMIT 1;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;
REVOKE ALL ON FUNCTION system_find_order_for_phone(text, text) FROM PUBLIC;

COMMIT;
