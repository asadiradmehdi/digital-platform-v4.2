BEGIN;
CREATE TABLE IF NOT EXISTS external_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES providers(id),
  provider_service_id uuid REFERENCES provider_services(id),
  external_order_id text NOT NULL,
  correlation_id text NOT NULL,
  request_payload jsonb NOT NULL DEFAULT '{}',
  response_payload jsonb,
  status text NOT NULL DEFAULT 'SUBMITTED',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, external_order_id),
  UNIQUE(order_id, provider_id, correlation_id)
);
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  signature_valid boolean NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  UNIQUE(source,event_id)
);
CREATE INDEX IF NOT EXISTS idx_external_orders_order ON external_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON webhook_events(received_at) WHERE processed_at IS NULL;
COMMIT;
