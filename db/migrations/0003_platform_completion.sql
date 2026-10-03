BEGIN;

CREATE TABLE IF NOT EXISTS plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  UNIQUE(plan_id, entitlement_key)
);
CREATE TABLE IF NOT EXISTS subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code text NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id),
  order_id uuid REFERENCES orders(id),
  discount_minor bigint NOT NULL CHECK(discount_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coupon_code, workspace_id)
);
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK(discount_type IN ('FIXED','PERCENT')),
  discount_value bigint NOT NULL CHECK(discount_value >= 0),
  max_redemptions bigint,
  redeemed_count bigint NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id),
  beneficiary_user_id uuid REFERENCES users(id),
  order_id uuid REFERENCES orders(id),
  amount_minor bigint NOT NULL CHECK(amount_minor >= 0),
  currency char(3) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES users(id),
  code text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES users(id),
  workspace_id uuid REFERENCES workspaces(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referral_id, referred_user_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
  title text,
  body text,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  status text NOT NULL,
  latency_ms integer,
  error text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS provider_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  success_rate numeric(7,4),
  refund_rate numeric(7,4),
  latency_ms integer,
  quality_score numeric(7,4),
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type text NOT NULL,
  capability_key text NOT NULL,
  supported boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE(channel_type, capability_key)
);
CREATE TABLE IF NOT EXISTS social_service_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  channel_type text NOT NULL,
  capability_key text NOT NULL,
  UNIQUE(service_id, channel_type, capability_key)
);

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  embedding_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id uuid NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_uri text,
  title text NOT NULL,
  content_hash text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(knowledge_base_id, content_hash)
);
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL CHECK(chunk_index >= 0),
  content text NOT NULL,
  embedding jsonb,
  token_count integer,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE(document_id, chunk_index)
);
CREATE TABLE IF NOT EXISTS agent_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  system_prompt text NOT NULL,
  model_key text,
  tools jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_definition_id uuid NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}',
  output jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error jsonb
);
CREATE TABLE IF NOT EXISTS agent_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  authorization_scope text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}',
  output jsonb,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id uuid NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  step_type text NOT NULL,
  position integer NOT NULL CHECK(position >= 0),
  config jsonb NOT NULL DEFAULT '{}',
  UNIQUE(workflow_version_id, step_key)
);
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  endpoint_secret_hash text NOT NULL,
  event_types text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scheduled_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  cron_expression text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  active boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}',
  environment text NOT NULL DEFAULT 'live' CHECK(environment IN ('test','live')),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS api_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  route text NOT NULL,
  status_code integer NOT NULL,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  window_seconds integer NOT NULL CHECK(window_seconds > 0),
  max_requests integer NOT NULL CHECK(max_requests > 0),
  UNIQUE(api_key_id, window_seconds)
);

CREATE TABLE IF NOT EXISTS content_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  slug text NOT NULL,
  canonical_path text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  indexable boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type, slug),
  UNIQUE(canonical_path)
);
CREATE TABLE IF NOT EXISTS content_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id uuid NOT NULL REFERENCES content_entities(id) ON DELETE CASCADE,
  to_entity_id uuid NOT NULL REFERENCES content_entities(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  UNIQUE(from_entity_id,to_entity_id,relation_type)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_base ON knowledge_documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace_time ON agent_runs(workspace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_provider_time ON provider_metrics(provider_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_workspace_time ON api_usage_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_entities_indexable ON content_entities(indexable, updated_at DESC);

COMMIT;
