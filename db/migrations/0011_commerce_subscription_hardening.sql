BEGIN;

-- Checkout is a server-side quote boundary. A checkout session owns its price snapshot;
-- clients never get to choose the final payable amount.
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','PAYMENT_PENDING','PAID','EXPIRED','CANCELLED')),
  currency char(3) NOT NULL,
  subtotal_minor bigint NOT NULL CHECK(subtotal_minor >= 0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK(discount_minor >= 0),
  total_minor bigint NOT NULL CHECK(total_minor >= 0),
  coupon_code text,
  quote_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_checkout_workspace_status ON checkout_sessions(workspace_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS checkout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id uuid NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id),
  plan_id uuid REFERENCES plans(id),
  quantity bigint NOT NULL CHECK(quantity > 0),
  unit_price_minor bigint NOT NULL CHECK(unit_price_minor >= 0),
  total_minor bigint NOT NULL CHECK(total_minor >= 0),
  currency char(3) NOT NULL,
  price_version bigint,
  pricing_rule_id uuid REFERENCES pricing_rules(id),
  fx_rate_id uuid REFERENCES fx_rates(id),
  provider_cost_minor bigint CHECK(provider_cost_minor IS NULL OR provider_cost_minor >= 0),
  provider_cost_currency char(3),
  parameters jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((service_id IS NOT NULL) <> (plan_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_checkout_items_session ON checkout_items(checkout_session_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity bigint NOT NULL CHECK(quantity > 0),
  unit_price_minor bigint NOT NULL CHECK(unit_price_minor >= 0),
  total_minor bigint NOT NULL CHECK(total_minor >= 0),
  currency char(3) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_minor bigint NOT NULL DEFAULT 0 CHECK(discount_minor >= 0);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_order ON invoices(order_id) WHERE order_id IS NOT NULL;

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS minimum_subtotal_minor bigint NOT NULL DEFAULT 0 CHECK(minimum_subtotal_minor >= 0);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_discount_minor bigint CHECK(max_discount_minor IS NULL OR max_discount_minor >= 0);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS per_workspace_limit integer NOT NULL DEFAULT 1 CHECK(per_workspace_limit > 0);
CREATE INDEX IF NOT EXISTS idx_coupons_active_window ON coupons(active,starts_at,expires_at);

-- Subscription lifecycle state is explicit so renewal/grace/cancellation jobs can be idempotent.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 0 CHECK(trial_days >= 0 AND trial_days <= 3650);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS grace_days integer NOT NULL DEFAULT 0 CHECK(grace_days >= 0 AND grace_days <= 365);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS rollover_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_until timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_price_minor bigint;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_price_currency char(3);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_price_version bigint;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_pricing_rule_id uuid REFERENCES pricing_rules(id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal ON subscriptions(status,auto_renew,current_period_end);

CREATE TABLE IF NOT EXISTS usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  consumed bigint NOT NULL DEFAULT 0 CHECK(consumed >= 0),
  limit_quantity bigint CHECK(limit_quantity IS NULL OR limit_quantity >= 0),
  rollover_quantity bigint NOT NULL DEFAULT 0 CHECK(rollover_quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id,metric_key,period_start)
);
CREATE INDEX IF NOT EXISTS idx_usage_counters_workspace_period ON usage_counters(workspace_id,period_end,metric_key);

CREATE TABLE IF NOT EXISTS subscription_entitlement_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id,entitlement_key)
);

CREATE TABLE IF NOT EXISTS commerce_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commerce_audit_aggregate ON commerce_audit_events(aggregate_type,aggregate_id,created_at DESC);

COMMIT;
