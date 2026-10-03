BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_status AS ENUM ('ACTIVE','SUSPENDED','DELETED');
CREATE TYPE workspace_status AS ENUM ('ACTIVE','SUSPENDED','ARCHIVED');
CREATE TYPE member_status AS ENUM ('ACTIVE','INVITED','SUSPENDED','REMOVED');
CREATE TYPE wallet_status AS ENUM ('ACTIVE','FROZEN','CLOSED');
CREATE TYPE ledger_direction AS ENUM ('DEBIT','CREDIT');
CREATE TYPE payment_status AS ENUM ('PENDING','AUTHORIZED','PAID','FAILED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED');
CREATE TYPE order_status AS ENUM ('CREATED','PAYMENT_PENDING','PAID','QUEUED','PROCESSING','PROVIDER_SUBMITTED','IN_PROGRESS','COMPLETED','FAILED','CANCELLED','REFUND_PENDING','REFUNDED');
CREATE TYPE attempt_status AS ENUM ('PENDING','SUBMITTED','SUCCEEDED','FAILED','UNKNOWN');
CREATE TYPE subscription_status AS ENUM ('TRIALING','ACTIVE','PAST_DUE','PAUSED','CANCELLED','EXPIRED');
CREATE TYPE provider_status AS ENUM ('ACTIVE','PAUSED','DISABLED');
CREATE TYPE channel_status AS ENUM ('CONNECTED','DISCONNECTED','EXPIRED','ERROR');
CREATE TYPE notification_status AS ENUM ('PENDING','SENT','FAILED','CANCELLED');
CREATE TYPE risk_state AS ENUM ('NORMAL','REVIEW','RESTRICTED');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  phone text UNIQUE,
  display_name text NOT NULL,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT users_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE user_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_type text NOT NULL,
  credential_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE(user_id, credential_type)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE TABLE mfa_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_type text NOT NULL,
  secret_ciphertext text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, method_type)
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status workspace_status NOT NULL DEFAULT 'ACTIVE',
  risk_state risk_state NOT NULL DEFAULT 'NORMAL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status member_status NOT NULL DEFAULT 'ACTIVE',
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  UNIQUE(workspace_id, name)
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE member_roles (
  member_id uuid NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY(member_id, role_id)
);

CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  currency char(3) NOT NULL DEFAULT 'IRR',
  status wallet_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  account_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wallet_id, account_code)
);

CREATE TABLE ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ledger_accounts(id),
  direction ledger_direction NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor > 0),
  currency char(3) NOT NULL,
  reference_type text NOT NULL,
  reference_id uuid,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, idempotency_key)
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  service_type text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, slug)
);

CREATE TABLE service_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  parameter_key text NOT NULL,
  data_type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  schema jsonb NOT NULL DEFAULT '{}',
  UNIQUE(service_id, parameter_key)
);

CREATE TABLE service_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  currency char(3) NOT NULL,
  unit_price_minor bigint NOT NULL CHECK(unit_price_minor >= 0),
  min_quantity bigint CHECK(min_quantity IS NULL OR min_quantity > 0),
  max_quantity bigint CHECK(max_quantity IS NULL OR max_quantity >= min_quantity),
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  status order_status NOT NULL DEFAULT 'CREATED',
  currency char(3) NOT NULL,
  subtotal_minor bigint NOT NULL CHECK(subtotal_minor >= 0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK(discount_minor >= 0),
  total_minor bigint NOT NULL CHECK(total_minor >= 0),
  risk_state risk_state NOT NULL DEFAULT 'NORMAL',
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, idempotency_key)
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id),
  quantity bigint NOT NULL CHECK(quantity > 0),
  unit_price_minor bigint NOT NULL CHECK(unit_price_minor >= 0),
  total_minor bigint NOT NULL CHECK(total_minor >= 0),
  parameters jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  actor_user_id uuid REFERENCES users(id),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_id uuid,
  status attempt_status NOT NULL DEFAULT 'PENDING',
  correlation_id text NOT NULL UNIQUE,
  idempotency_key text NOT NULL,
  response jsonb,
  retry_count integer NOT NULL DEFAULT 0 CHECK(retry_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, idempotency_key)
);

CREATE TABLE providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_type text NOT NULL,
  status provider_status NOT NULL DEFAULT 'ACTIVE',
  balance_minor bigint,
  currency char(3),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_attempts ADD CONSTRAINT order_attempts_provider_fk FOREIGN KEY(provider_id) REFERENCES providers(id);

CREATE TABLE provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  credential_name text NOT NULL,
  secret_ciphertext text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, credential_name)
);

CREATE TABLE provider_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  external_service_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE(provider_id, service_id),
  UNIQUE(provider_id, external_service_id)
);

CREATE TABLE provider_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  weight integer NOT NULL DEFAULT 100 CHECK(weight >= 0),
  active boolean NOT NULL DEFAULT true,
  UNIQUE(service_id, provider_id)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  order_id uuid REFERENCES orders(id),
  amount_minor bigint NOT NULL CHECK(amount_minor > 0),
  currency char(3) NOT NULL,
  status payment_status NOT NULL DEFAULT 'PENDING',
  gateway text NOT NULL,
  gateway_reference text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gateway, gateway_reference),
  UNIQUE(workspace_id, idempotency_key)
);

CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  status payment_status NOT NULL DEFAULT 'PENDING',
  gateway_reference text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id),
  amount_minor bigint NOT NULL CHECK(amount_minor > 0),
  currency char(3) NOT NULL,
  status payment_status NOT NULL DEFAULT 'PENDING',
  gateway_reference text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  invoice_number text NOT NULL UNIQUE,
  currency char(3) NOT NULL,
  subtotal_minor bigint NOT NULL CHECK(subtotal_minor >= 0),
  total_minor bigint NOT NULL CHECK(total_minor >= 0),
  status text NOT NULL,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  billing_interval text NOT NULL,
  price_minor bigint NOT NULL CHECK(price_minor >= 0),
  currency char(3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  plan_id uuid NOT NULL REFERENCES plans(id),
  status subscription_status NOT NULL DEFAULT 'ACTIVE',
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  metric_key text NOT NULL,
  quantity bigint NOT NULL CHECK(quantity >= 0),
  unit text NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL,
  UNIQUE(workspace_id, idempotency_key)
);

CREATE TABLE ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status provider_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_provider_id uuid NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  model_key text NOT NULL,
  display_name text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '{}',
  context_limit bigint,
  active boolean NOT NULL DEFAULT true,
  UNIQUE(ai_provider_id, model_key)
);

CREATE TABLE ai_model_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_model_id uuid NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
  input_price_minor bigint NOT NULL CHECK(input_price_minor >= 0),
  output_price_minor bigint NOT NULL CHECK(output_price_minor >= 0),
  unit text NOT NULL,
  currency char(3) NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz
);

CREATE TABLE ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  ai_model_id uuid NOT NULL REFERENCES ai_models(id),
  request_type text NOT NULL,
  status text NOT NULL,
  idempotency_key text NOT NULL,
  input_units bigint,
  output_units bigint,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(workspace_id, idempotency_key)
);

CREATE TABLE ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_request_id uuid NOT NULL REFERENCES ai_requests(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  metric_key text NOT NULL,
  quantity bigint NOT NULL CHECK(quantity >= 0),
  unit text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_type text NOT NULL,
  display_name text NOT NULL,
  status channel_status NOT NULL DEFAULT 'DISCONNECTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, channel_type, display_name)
);

CREATE TABLE channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  external_account_id text,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE social_analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL,
  metrics jsonb NOT NULL,
  UNIQUE(channel_id, captured_at)
);

CREATE TABLE workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK(version > 0),
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, version)
);

CREATE TABLE workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id uuid NOT NULL REFERENCES workflow_versions(id),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error jsonb
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status notification_status NOT NULL DEFAULT 'PENDING',
  provider_reference text,
  sent_at timestamptz,
  error jsonb
);

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  priority text NOT NULL DEFAULT 'NORMAL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  ip inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(scope, key)
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  last_error text
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_orders_workspace_created ON orders(workspace_id, created_at DESC);
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX idx_order_events_order_created ON order_events(order_id, created_at);
CREATE INDEX idx_order_attempts_order ON order_attempts(order_id);
CREATE INDEX idx_payments_workspace_created ON payments(workspace_id, created_at DESC);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_ledger_entries_account_created ON ledger_entries(account_id, created_at DESC);
CREATE INDEX idx_usage_workspace_metric_time ON usage_events(workspace_id, metric_key, occurred_at DESC);
CREATE INDEX idx_ai_usage_workspace_time ON ai_usage_events(workspace_id, created_at DESC);
CREATE INDEX idx_channels_workspace ON channels(workspace_id);
CREATE INDEX idx_social_snapshots_channel_time ON social_analytics_snapshots(channel_id, captured_at DESC);
CREATE INDEX idx_workflow_runs_workspace_time ON workflow_runs(workspace_id, started_at DESC);
CREATE INDEX idx_notifications_user_time ON notifications(user_id, created_at DESC);
CREATE INDEX idx_audit_workspace_time ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_outbox_unpublished ON outbox_events(occurred_at) WHERE published_at IS NULL;

COMMIT;
