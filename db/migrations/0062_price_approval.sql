BEGIN;

-- Admin console price workflow. A price is never edited: a new row is inserted as a DRAFT (inactive) and
-- approving it closes the current active row (active=false, effective_to=now) and activates the draft
-- (effective_from=now), so the history of what customers paid stays intact.
--   approval_status  DRAFT (waiting for the owner) | APPROVED | REJECTED (replaced by a newer draft or declined)
--   approved_at      NULL on an ACTIVE row means «seeded price the owner has not confirmed yet»
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'APPROVED';
ALTER TABLE service_prices DROP CONSTRAINT IF EXISTS service_prices_approval_status_check;
ALTER TABLE service_prices ADD CONSTRAINT service_prices_approval_status_check CHECK (approval_status IN ('DRAFT','APPROVED','REJECTED'));
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE service_prices DROP CONSTRAINT IF EXISTS service_prices_draft_inactive_check;
ALTER TABLE service_prices ADD CONSTRAINT service_prices_draft_inactive_check CHECK (approval_status = 'APPROVED' OR active = false);
CREATE INDEX IF NOT EXISTS idx_service_prices_draft ON service_prices(service_id) WHERE approval_status = 'DRAFT';

COMMIT;
