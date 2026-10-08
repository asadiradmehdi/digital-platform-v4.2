BEGIN;

-- Cross-tenant system reads under FORCE ROW LEVEL SECURITY.
--
-- The application connects as a NOSUPERUSER/NOBYPASSRLS role that also owns the tables, and every
-- tenant table has FORCE ROW LEVEL SECURITY, so even SECURITY DEFINER functions owned by that role are
-- filtered by tenant_isolation (verified: a definer function sees 0 rows without a workspace context).
-- A handful of system paths must still locate rows before they know the workspace: the platform-admin
-- dashboard, the renewal and stuck-order cron scans, the payment webhook (lookup by gateway reference)
-- and API-key authentication (lookup by key hash).
--
-- Design:
--   * app_system_read() is true only while the GUC app.rls_system_read = 'on'.
--   * Each table below gets ONE extra policy, FOR SELECT only, gated on app_system_read(). The
--     tenant_isolation policies are unchanged; INSERT/UPDATE/DELETE still require the tenant context.
--   * The GUC is never set by application code (scripts/verify-rls-boundaries.sh enforces this). It is
--     set only inside the narrow functions below, transaction-locally, for the duration of their single
--     RETURN QUERY, and restored to its previous value before they return. On error the enclosing
--     (sub)transaction aborts, which also reverts the setting. (A function-level SET clause would be
--     tidier, but PostgreSQL 16 refuses SET of a custom placeholder parameter for non-superusers.)
--   * Each function returns only routing data (ids + workspace_id) or aggregates. The caller then does
--     the per-row work inside withTenantTransaction(workspace_id, ...).
--   * The admin aggregate function must only be called after the platform-admin check in code.
--
-- Ownership/EXECUTE: the functions are owned by the migration role, which is the application role in
-- this deployment, so the owner keeps EXECUTE after REVOKE ... FROM PUBLIC. If the migration and runtime
-- roles are ever split, GRANT EXECUTE on these functions to the runtime role explicitly.
-- SECURITY DEFINER pins search_path and lets a future, less-privileged runtime role call them without
-- direct table access; with today's single role it grants nothing extra.

CREATE OR REPLACE FUNCTION app_system_read()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.rls_system_read', true), '') = 'on';
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders','payments','subscriptions','operational_events','api_keys']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS system_read ON %I', t);
    EXECUTE format('CREATE POLICY system_read ON %I FOR SELECT USING (app_system_read())', t);
  END LOOP;
END $$;

-- Platform-admin dashboard: aggregate counts only, never row data.
CREATE OR REPLACE FUNCTION system_admin_dashboard_stats()
RETURNS TABLE(metric text, bucket text, row_count bigint, amount_minor numeric, last_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT 'orders_by_status', o.status::text, count(*), NULL::numeric, NULL::timestamptz
      FROM orders o GROUP BY o.status
    UNION ALL
    SELECT 'orders_last_24h', NULL, count(*), NULL, NULL
      FROM orders o WHERE o.created_at > now() - interval '24 hours'
    UNION ALL
    SELECT 'payments_by_status', p.status::text, count(*), COALESCE(sum(p.amount_minor), 0), NULL
      FROM payments p GROUP BY p.status
    UNION ALL
    SELECT 'subscriptions_by_status', s.status::text, count(*), NULL, NULL
      FROM subscriptions s GROUP BY s.status
    UNION ALL
    SELECT 'operational_events_24h_by_severity', e.severity, count(*), NULL, max(e.created_at)
      FROM operational_events e WHERE e.created_at > now() - interval '24 hours' GROUP BY e.severity;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Payment webhook: map a gateway reference to (payment, workspace). At most two rows are returned so the
-- caller can refuse an ambiguous reference instead of guessing a tenant.
CREATE OR REPLACE FUNCTION system_find_payment_by_gateway_reference(p_gateway_reference text)
RETURNS TABLE(payment_id uuid, workspace_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT p.id, p.workspace_id FROM payments p
    WHERE p.gateway_reference = p_gateway_reference
    ORDER BY p.created_at
    LIMIT 2;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- API-key authentication: resolve an active key by its SHA-256 hash (the raw key never reaches SQL).
CREATE OR REPLACE FUNCTION system_resolve_api_key(p_key_hash text)
RETURNS TABLE(api_key_id uuid, workspace_id uuid, scopes text[], environment text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT k.id, k.workspace_id, k.scopes, k.environment FROM api_keys k
    WHERE k.key_hash = p_key_hash
      AND k.revoked_at IS NULL
      AND (k.expires_at IS NULL OR k.expires_at > now());
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Renewal cron: subscriptions whose period has ended and that should auto-renew.
CREATE OR REPLACE FUNCTION system_due_subscription_renewals(p_limit integer)
RETURNS TABLE(subscription_id uuid, workspace_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT s.id, s.workspace_id FROM subscriptions s
    WHERE s.status IN ('ACTIVE','TRIALING')
      AND s.auto_renew = true
      AND s.cancel_at_period_end = false
      AND s.current_period_end <= now()
    ORDER BY s.current_period_end ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Stuck-order recovery cron: QUEUED orders never handed to a provider.
CREATE OR REPLACE FUNCTION system_stale_queued_orders(p_stale_minutes integer, p_limit integer)
RETURNS TABLE(order_id uuid, workspace_id uuid, service_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT o.id, o.workspace_id, oi.service_id
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'QUEUED'
      AND o.updated_at < now() - make_interval(mins => GREATEST(COALESCE(p_stale_minutes, 15), 1))
      AND NOT EXISTS (SELECT 1 FROM external_orders eo WHERE eo.order_id = o.id)
    ORDER BY o.updated_at
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 500);
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Lookups by gateway reference alone cannot use the (gateway, gateway_reference) unique index.
CREATE INDEX IF NOT EXISTS idx_payments_gateway_reference ON payments(gateway_reference) WHERE gateway_reference IS NOT NULL;

REVOKE ALL ON FUNCTION system_admin_dashboard_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION system_find_payment_by_gateway_reference(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_resolve_api_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_due_subscription_renewals(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_stale_queued_orders(integer, integer) FROM PUBLIC;

COMMIT;
