BEGIN;

-- Currency is explicit: IRR is the internal accounting unit; IRT is the customer-facing
-- toman display/price unit. Payment adapters are responsible for gateway-specific conversion.
CREATE TABLE IF NOT EXISTS currencies (
  code char(3) PRIMARY KEY,
  display_name text NOT NULL,
  minor_unit_scale integer NOT NULL DEFAULT 0 CHECK(minor_unit_scale >= 0 AND minor_unit_scale <= 6),
  active boolean NOT NULL DEFAULT true
);
INSERT INTO currencies(code,display_name,minor_unit_scale) VALUES
  ('USD','US Dollar',2),('EUR','Euro',2),('IRR','Iranian Rial',0),('IRT','Iranian Toman',0)
ON CONFLICT(code) DO NOTHING;

ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS margin_mode text NOT NULL DEFAULT 'MARKUP'
  CHECK (margin_mode IN ('MARKUP','MARGIN'));
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS min_price_minor bigint CHECK(min_price_minor IS NULL OR min_price_minor >= 0);
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS max_price_minor bigint CHECK(max_price_minor IS NULL OR max_price_minor >= 0);
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS stale_rate_policy text NOT NULL DEFAULT 'USE_LAST_KNOWN_GOOD'
  CHECK (stale_rate_policy IN ('USE_LAST_KNOWN_GOOD','FREEZE_PRICE','BLOCK_PURCHASE'));
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS max_rate_age_seconds integer NOT NULL DEFAULT 3600
  CHECK(max_rate_age_seconds > 0);
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id);

CREATE TABLE IF NOT EXISTS fx_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  timeout_ms integer NOT NULL DEFAULT 5000 CHECK(timeout_ms > 0),
  max_rate_age_seconds integer NOT NULL DEFAULT 3600 CHECK(max_rate_age_seconds > 0),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fx_sources_active_priority ON fx_sources(active,priority);

ALTER TABLE fx_rates ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES fx_sources(id);
ALTER TABLE fx_rates ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
ALTER TABLE fx_rates ADD COLUMN IF NOT EXISTS observed_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_fx_rates_verified_latest
  ON fx_rates(base_currency,quote_currency,is_verified,fetched_at DESC);

-- Provider cost is distinct from the customer selling price. Changing provider cost or
-- route never mutates historical orders.
CREATE TABLE IF NOT EXISTS provider_service_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_service_id uuid NOT NULL REFERENCES provider_services(id) ON DELETE CASCADE,
  unit_cost_minor bigint NOT NULL CHECK(unit_cost_minor >= 0),
  currency char(3) NOT NULL,
  unit text NOT NULL DEFAULT 'UNIT',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_service_costs_latest
  ON provider_service_costs(provider_service_id,active,effective_from DESC);

ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS provider_cost_minor bigint CHECK(provider_cost_minor IS NULL OR provider_cost_minor >= 0);
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS provider_cost_currency char(3);
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS price_version bigint NOT NULL DEFAULT 1;
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS price_updated_at timestamptz;

-- A quote is immutable once an order is created.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_version bigint;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS pricing_rule_id uuid REFERENCES pricing_rules(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fx_rate_id uuid REFERENCES fx_rates(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quoted_at timestamptz;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS provider_cost_minor bigint CHECK(provider_cost_minor IS NULL OR provider_cost_minor >= 0);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS provider_cost_currency char(3);

-- Subscription renewals must use the price agreed at the subscription/renewal boundary.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_version bigint NOT NULL DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price_minor bigint;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS currency char(3);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price_version bigint;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pricing_rule_id uuid REFERENCES pricing_rules(id);

CREATE TABLE IF NOT EXISTS pricing_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_rule_id uuid REFERENCES pricing_rules(id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES users(id),
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_audit_target ON pricing_audit_events(target_type,target_id,created_at DESC);

CREATE TABLE IF NOT EXISTS pricing_refresh_locks (
  lock_key text PRIMARY KEY,
  locked_until timestamptz NOT NULL,
  owner_id text NOT NULL
);

COMMIT;
