BEGIN;

-- Operational and audit evidence are append-only. Ordinary application paths may insert, never mutate history.
CREATE OR REPLACE FUNCTION deny_observability_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;

DROP TRIGGER IF EXISTS trg_operational_events_immutable ON operational_events;
CREATE TRIGGER trg_operational_events_immutable
BEFORE UPDATE OR DELETE ON operational_events
FOR EACH ROW EXECUTE FUNCTION deny_observability_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION deny_observability_mutation();

-- Security evidence was already protected; keep the same invariant explicit for operational evidence.
CREATE INDEX IF NOT EXISTS idx_operational_events_type_time ON operational_events(event_type,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_events_request ON operational_events(request_id) WHERE request_id IS NOT NULL;

-- Metric snapshots are server telemetry, not tenant data. Keep access server-side and bound the value range.
ALTER TABLE metric_snapshots ADD CONSTRAINT metric_snapshots_value_finite CHECK (value <> 'NaN'::numeric);

COMMIT;
