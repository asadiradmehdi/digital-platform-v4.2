BEGIN;

-- Dynamic pricing is source-of-truth driven: upstream cost + FX + per-target margin
-- produce the current customer-facing price. Generated prices are never edited manually.
CREATE TABLE IF NOT EXISTS pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('PLAN','SERVICE')),
  target_id uuid NOT NULL,
  base_currency char(3) NOT NULL,
  base_amount_minor bigint NOT NULL CHECK(base_amount_minor >= 0),
  margin_bps integer NOT NULL DEFAULT 0 CHECK (margin_bps >= 0 AND margin_bps <= 100000),
  rounding_increment_minor bigint NOT NULL DEFAULT 1000 CHECK (rounding_increment_minor > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_type, target_id)
);

CREATE TABLE IF NOT EXISTS fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency char(3) NOT NULL,
  quote_currency char(3) NOT NULL,
  rate_numerator numeric(38,18) NOT NULL CHECK(rate_numerator > 0),
  rate_denominator numeric(38,18) NOT NULL CHECK(rate_denominator > 0),
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE(base_currency, quote_currency, fetched_at)
);
CREATE INDEX IF NOT EXISTS idx_fx_rates_latest ON fx_rates(base_currency,quote_currency,fetched_at DESC);

CREATE TABLE IF NOT EXISTS generated_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_rule_id uuid NOT NULL REFERENCES pricing_rules(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('PLAN','SERVICE')),
  target_id uuid NOT NULL,
  base_amount_minor bigint NOT NULL CHECK(base_amount_minor >= 0),
  base_currency char(3) NOT NULL,
  fx_rate_id uuid NOT NULL REFERENCES fx_rates(id),
  margin_bps integer NOT NULL CHECK(margin_bps >= 0),
  final_amount_minor bigint NOT NULL CHECK(final_amount_minor >= 0),
  final_currency char(3) NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pricing_rule_id, generated_at)
);
CREATE INDEX IF NOT EXISTS idx_generated_prices_target ON generated_prices(target_type,target_id,generated_at DESC);

CREATE TABLE IF NOT EXISTS pricing_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  status text NOT NULL,
  fx_rate_id uuid REFERENCES fx_rates(id),
  targets_updated integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE plans ADD COLUMN IF NOT EXISTS pricing_rule_id uuid REFERENCES pricing_rules(id);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS base_price_minor bigint;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS base_currency char(3);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_generated_at timestamptz;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_source text;

ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS pricing_rule_id uuid REFERENCES pricing_rules(id);
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS base_unit_price_minor bigint;
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS base_currency char(3);
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS price_generated_at timestamptz;
ALTER TABLE service_prices ADD COLUMN IF NOT EXISTS price_source text;

COMMIT;
