BEGIN;

-- Price change batches. Every save from the package editor, every category-wide percent change and every
-- undo is one batch with the full price state before and after, so «بازگشت به قبل» restores exactly what
-- customers saw. Batches are append-only history (only undone_at/undone_by are ever stamped).
--   before_state / after_state: { "unit": <toman per unit>, "packages": { "<quantity>": <total toman> } }
--   kind: EDIT (package editor) | BULK (category percent change) | UNDO (restores a batch's before_state)
--   group_id: batches created by one category-wide change share it, so the whole change can be undone.
CREATE TABLE IF NOT EXISTS service_price_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('EDIT','BULK','UNDO')),
  group_id uuid,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  idempotency_key text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undone_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_price_batch_idem ON service_price_batches(service_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_price_batch_service ON service_price_batches(service_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_price_batch_group ON service_price_batches(group_id) WHERE group_id IS NOT NULL;

ALTER TABLE service_package_prices ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES service_price_batches(id) ON DELETE SET NULL;
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES service_price_batches(id) ON DELETE SET NULL;

COMMIT;
