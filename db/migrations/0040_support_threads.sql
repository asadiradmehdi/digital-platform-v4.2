-- Migration: 0040_support_threads
-- Support tickets become conversations: a human-friendly code, a category, an optional order link,
-- and a message thread (customer ⇄ staff). Statuses: OPEN (new), ANSWERED (staff replied),
-- PENDING (customer replied, waiting on staff), CLOSED.
--
-- Existing rows stay valid: they get a code, category OTHER, last_message_at = updated_at, and their
-- legacy statuses are mapped (RESOLVED → CLOSED, IN_PROGRESS → PENDING).
BEGIN;

CREATE SEQUENCE IF NOT EXISTS support_ticket_code_seq START WITH 10001;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'OTHER',
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS has_unread_staff_reply boolean NOT NULL DEFAULT false;

-- Backfill under FORCE RLS: the migration role is subject to tenant_isolation, so the policy is lifted
-- for this transaction only and restored before COMMIT (a failure rolls both back).
ALTER TABLE support_tickets NO FORCE ROW LEVEL SECURITY;
UPDATE support_tickets SET code = 'ZT-' || nextval('support_ticket_code_seq') WHERE code IS NULL;
UPDATE support_tickets SET last_message_at = updated_at;
UPDATE support_tickets SET status = 'CLOSED' WHERE status = 'RESOLVED';
UPDATE support_tickets SET status = 'PENDING' WHERE status NOT IN ('OPEN', 'ANSWERED', 'PENDING', 'CLOSED');
ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY;

ALTER TABLE support_tickets ALTER COLUMN code SET DEFAULT 'ZT-' || nextval('support_ticket_code_seq');
ALTER TABLE support_tickets ALTER COLUMN code SET NOT NULL;
ALTER SEQUENCE support_ticket_code_seq OWNED BY support_tickets.code;

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('OPEN', 'ANSWERED', 'PENDING', 'CLOSED'));
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_category_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_category_check
  CHECK (category IN ('ORDER', 'PAYMENT', 'ACCOUNT', 'AI_SUBSCRIPTION', 'TECHNICAL', 'OTHER'));
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_subject_length;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_subject_length
  CHECK (char_length(subject) BETWEEN 1 AND 160) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_support_tickets_code ON support_tickets(code);
-- Lets messages reference (ticket, workspace) so a message can never point at another tenant's ticket.
CREATE UNIQUE INDEX IF NOT EXISTS uq_support_tickets_id_workspace ON support_tickets(id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_recent ON support_tickets(workspace_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_order ON support_tickets(order_id) WHERE order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL,
  author_user_id uuid REFERENCES users(id),
  author_kind text NOT NULL CHECK (author_kind IN ('CUSTOMER', 'STAFF')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (ticket_id, workspace_id) REFERENCES support_tickets(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_thread ON support_ticket_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_workspace ON support_ticket_messages(workspace_id, created_at DESC);

ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON support_ticket_messages;
CREATE POLICY tenant_isolation ON support_ticket_messages
  USING (workspace_id = app_workspace_id())
  WITH CHECK (workspace_id = app_workspace_id());

COMMIT;
