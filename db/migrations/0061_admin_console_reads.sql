BEGIN;

-- Admin console (برنامه مدیریت): cross-tenant READ functions, following the migration 0031 pattern.
-- orders/payments/wallets are FORCE-RLS tables; the platform admin must see all tenants, so each function
-- raises app.rls_system_read for the single RETURN QUERY and restores it afterwards. They return
-- aggregates or a bounded page of rows (never secrets). Application code calls them only after
-- requirePlatformAdmin(); EXECUTE is revoked from PUBLIC. All money is returned in TOMAN
-- (IRT minor units are toman, IRR minor units are rial and are divided by 10).

DROP POLICY IF EXISTS system_read ON wallets;
CREATE POLICY system_read ON wallets FOR SELECT USING (app_system_read());

-- Revenue dashboard. «today» starts at midnight in Asia/Tehran; 7d / 30d are rolling windows.
--   sales            bucket '' : orders that reached a paid state (count + order totals)
--   orders_by_status bucket = status
--   payments         bucket TOPUP (wallet top-ups) | DIRECT (gateway payment of an order/checkout)
--   category         bucket = product slug (the catalogue category), from order_items
CREATE OR REPLACE FUNCTION system_admin_revenue()
RETURNS TABLE(metric text, period text, bucket text, row_count bigint, amount_toman numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    WITH per(p, since) AS (VALUES
      ('today', date_trunc('day', now() AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'Asia/Tehran'),
      ('d7', now() - interval '7 days'),
      ('d30', now() - interval '30 days')
    )
    SELECT 'sales'::text, per.p, ''::text, count(*), COALESCE(sum(CASE WHEN o.currency = 'IRR' THEN o.total_minor / 10.0 ELSE o.total_minor END), 0)
      FROM per JOIN orders o ON o.created_at >= per.since
      WHERE o.status IN ('PAID','QUEUED','PROCESSING','PROVIDER_SUBMITTED','IN_PROGRESS','COMPLETED')
      GROUP BY per.p
    UNION ALL
    SELECT 'orders_by_status', per.p, o.status::text, count(*), NULL::numeric
      FROM per JOIN orders o ON o.created_at >= per.since
      GROUP BY per.p, o.status
    UNION ALL
    SELECT 'payments', per.p,
           CASE WHEN pay.purpose = 'TOPUP' OR (pay.purpose IS NULL AND pay.order_id IS NULL) THEN 'TOPUP' ELSE 'DIRECT' END,
           count(*), COALESCE(sum(CASE WHEN pay.currency = 'IRR' THEN pay.amount_minor / 10.0 ELSE pay.amount_minor END), 0)
      FROM per JOIN payments pay ON pay.created_at >= per.since
      WHERE pay.status = 'PAID'
      GROUP BY per.p, 3
    UNION ALL
    SELECT 'category', per.p, pr.slug, count(DISTINCT o.id),
           COALESCE(sum(CASE WHEN o.currency = 'IRR' THEN oi.total_minor / 10.0 ELSE oi.total_minor END), 0)
      FROM per
      JOIN orders o ON o.created_at >= per.since
      JOIN order_items oi ON oi.order_id = o.id
      JOIN services s ON s.id = oi.service_id
      JOIN products pr ON pr.id = s.product_id
      WHERE o.status IN ('PAID','QUEUED','PROCESSING','PROVIDER_SUBMITTED','IN_PROGRESS','COMPLETED')
      GROUP BY per.p, pr.slug;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Orders page: one bounded page of orders across all workspaces (newest first), optional status filter.
CREATE OR REPLACE FUNCTION system_admin_orders(p_status text, p_limit integer, p_offset integer)
RETURNS TABLE(order_id uuid, workspace_id uuid, status text, total_toman numeric, created_at timestamptz,
              owner_name text, owner_phone text, service_name text, product_slug text, quantity bigint, total_count bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT pg.id, pg.workspace_id, pg.status::text, pg.total, pg.created_at,
           u.display_name, u.phone, it.name, it.slug, it.quantity, pg.total_count
    FROM (
      SELECT o.id, o.workspace_id, o.status, o.created_at,
             CASE WHEN o.currency = 'IRR' THEN o.total_minor / 10.0 ELSE o.total_minor::numeric END AS total,
             count(*) OVER () AS total_count
      FROM orders o
      WHERE p_status IS NULL OR o.status::text = p_status
      ORDER BY o.created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    ) pg
    LEFT JOIN workspaces w ON w.id = pg.workspace_id
    LEFT JOIN users u ON u.id = w.owner_user_id
    LEFT JOIN LATERAL (
      SELECT s.name, pr.slug, oi.quantity FROM order_items oi
      JOIN services s ON s.id = oi.service_id JOIN products pr ON pr.id = s.product_id
      WHERE oi.order_id = pg.id ORDER BY oi.id LIMIT 1
    ) it ON true
    ORDER BY pg.created_at DESC;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Users page: a bounded page of users with the wallet balance (ledger MAIN accounts of the workspaces
-- they own, in toman) and their order count. Search matches name, e-mail or phone.
CREATE OR REPLACE FUNCTION system_admin_users(p_search text, p_limit integer, p_offset integer)
RETURNS TABLE(user_id uuid, display_name text, email text, phone text, status text, created_at timestamptz,
              wallet_balance_toman numeric, order_count bigint, total_count bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  prev text := current_setting('app.rls_system_read', true);
  pat text := CASE WHEN p_search IS NULL OR btrim(p_search) = '' THEN NULL
    ELSE '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT pg.id, pg.display_name, pg.email, pg.phone, pg.status::text, pg.created_at,
           COALESCE(bal.v, 0), COALESCE(oc.v, 0), pg.total_count
    FROM (
      SELECT u.id, u.display_name, u.email, u.phone, u.status, u.created_at, count(*) OVER () AS total_count
      FROM users u
      WHERE pat IS NULL OR u.display_name ILIKE pat OR u.email ILIKE pat OR u.phone ILIKE pat
      ORDER BY u.created_at DESC, u.id
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    ) pg
    LEFT JOIN LATERAL (
      SELECT sum(CASE WHEN le.direction = 'CREDIT' THEN 1 ELSE -1 END * CASE WHEN wa.currency = 'IRR' THEN le.amount_minor / 10.0 ELSE le.amount_minor::numeric END) AS v
      FROM workspaces w
      JOIN wallets wa ON wa.workspace_id = w.id
      JOIN ledger_accounts la ON la.wallet_id = wa.id AND la.account_code = 'MAIN'
      JOIN ledger_entries le ON le.account_id = la.id
      WHERE w.owner_user_id = pg.id
    ) bal ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS v FROM orders o JOIN workspaces w ON w.id = o.workspace_id WHERE w.owner_user_id = pg.id
    ) oc ON true
    ORDER BY pg.created_at DESC, pg.id;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

REVOKE ALL ON FUNCTION system_admin_revenue() FROM PUBLIC;
REVOKE ALL ON FUNCTION system_admin_orders(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_admin_users(text, integer, integer) FROM PUBLIC;

COMMIT;
