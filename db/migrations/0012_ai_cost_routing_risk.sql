BEGIN;

-- AI cost accounting: immutable cost records, separate from user-facing usage/entitlements.
CREATE TABLE IF NOT EXISTS ai_cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_request_id uuid NOT NULL REFERENCES ai_requests(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ai_provider_id uuid NOT NULL REFERENCES ai_providers(id),
  ai_model_id uuid NOT NULL REFERENCES ai_models(id),
  input_units bigint NOT NULL DEFAULT 0 CHECK(input_units >= 0),
  output_units bigint NOT NULL DEFAULT 0 CHECK(output_units >= 0),
  cost_minor bigint NOT NULL CHECK(cost_minor >= 0),
  currency char(3) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ai_request_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_cost_workspace_time ON ai_cost_events(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_provider_time ON ai_cost_events(ai_provider_id,created_at DESC);

-- Provider routing policy is data, not application constants.
CREATE TABLE IF NOT EXISTS provider_routing_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  quality_weight numeric(8,6) NOT NULL DEFAULT .25 CHECK(quality_weight >= 0),
  reliability_weight numeric(8,6) NOT NULL DEFAULT .30 CHECK(reliability_weight >= 0),
  latency_weight numeric(8,6) NOT NULL DEFAULT .15 CHECK(latency_weight >= 0),
  cost_weight numeric(8,6) NOT NULL DEFAULT .20 CHECK(cost_weight >= 0),
  refund_weight numeric(8,6) NOT NULL DEFAULT .10 CHECK(refund_weight >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id)
);

CREATE TABLE IF NOT EXISTS provider_route_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id),
  provider_id uuid NOT NULL REFERENCES providers(id),
  correlation_id text NOT NULL,
  score numeric(20,10),
  reason jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_route_decisions_service_time ON provider_route_decisions(service_id,created_at DESC);

-- Risk evidence is append-only; the workspace risk_state remains the current aggregate state.
CREATE TABLE IF NOT EXISTS risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  signal_key text NOT NULL,
  score integer NOT NULL CHECK(score >= 0),
  reason text NOT NULL,
  hard_block boolean NOT NULL DEFAULT false,
  source text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risk_events_workspace_time ON risk_events(workspace_id,created_at DESC);

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0 CHECK(risk_score >= 0);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS risk_evaluated_at timestamptz;

COMMIT;
