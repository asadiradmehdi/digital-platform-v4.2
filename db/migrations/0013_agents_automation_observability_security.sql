BEGIN;

-- Agent governance: explicit permissions, budgets and versioned policy.
CREATE TABLE IF NOT EXISTS agent_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_definition_id uuid NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK(version > 0),
  permissions text[] NOT NULL DEFAULT '{}',
  max_tool_calls integer NOT NULL DEFAULT 25 CHECK(max_tool_calls > 0),
  max_runtime_ms integer NOT NULL DEFAULT 120000 CHECK(max_runtime_ms > 0),
  max_estimated_cost_minor bigint CHECK(max_estimated_cost_minor IS NULL OR max_estimated_cost_minor >= 0),
  currency char(3),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_definition_id, version)
);
CREATE INDEX IF NOT EXISTS idx_agent_policies_active ON agent_policies(agent_definition_id, active);

CREATE TABLE IF NOT EXISTS agent_tool_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_definition_id uuid NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  side_effecting boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_definition_id, tool_name)
);

ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS policy_version integer;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS tool_calls integer NOT NULL DEFAULT 0 CHECK(tool_calls >= 0);
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS estimated_cost_minor bigint NOT NULL DEFAULT 0 CHECK(estimated_cost_minor >= 0);
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS correlation_id text;
CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace_status ON agent_runs(workspace_id,status,started_at DESC);

-- Workflow execution guardrails and step-level observability.
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS steps_executed integer NOT NULL DEFAULT 0 CHECK(steps_executed >= 0);
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS max_steps integer NOT NULL DEFAULT 100 CHECK(max_steps > 0);
CREATE TABLE IF NOT EXISTS workflow_step_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  attempt integer NOT NULL DEFAULT 1 CHECK(attempt > 0),
  status text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}',
  output jsonb,
  error jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_run ON workflow_step_runs(workflow_run_id,started_at);

-- Append-only operational events for traceability without storing secrets.
CREATE TABLE IF NOT EXISTS operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  correlation_id text,
  request_id text,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'INFO',
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operational_events_workspace_time ON operational_events(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_events_correlation ON operational_events(correlation_id) WHERE correlation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  labels jsonb NOT NULL DEFAULT '{}',
  value numeric(30,10) NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_name_time ON metric_snapshots(metric_name,captured_at DESC);

-- Security policy registry for outbound integrations and sensitive operations.
CREATE TABLE IF NOT EXISTS security_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  policy_key text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, policy_key)
);

COMMIT;
