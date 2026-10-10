BEGIN;

-- Admin console overhaul («برنامه مدیریت»): per-package prices, unit costs, catalogue ordering/hints,
-- internal order notes, ticket assignment and the cross-tenant READ functions the new pages need.
-- Same security model as 0031/0061: tenant tables stay FORCE-RLS; platform-admin screens read them through
-- SECURITY DEFINER functions that raise app.rls_system_read for a single statement; writes always happen in
-- withTenantTransaction(workspace_id). Application code calls these only after requirePlatformAdmin().

-- ── 1. Package prices ──────────────────────────────────────────────────────────────────────────────
-- A listed package (e.g. 3 months of an AI plan, 5,000 followers) normally costs quantity × the service's
-- unit price. A row here pins ONE package to its own total price (IRT = toman, same unit as
-- service_prices.unit_price_minor), so a 3-month plan can be cheaper than 3 × the 1-month plan.
-- Append-only: a change closes the active row (active=false, effective_to=now()) and inserts a new one.
-- DRAFT rows are inactive until approved. Not tenant-scoped (catalogue data, no workspace_id).
CREATE TABLE IF NOT EXISTS service_package_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  quantity bigint NOT NULL CHECK (quantity > 0),
  price_minor bigint NOT NULL CHECK (price_minor > 0),
  currency char(3) NOT NULL DEFAULT 'IRT' CHECK (currency = 'IRT'),
  active boolean NOT NULL DEFAULT false,
  approval_status text NOT NULL DEFAULT 'APPROVED' CHECK (approval_status IN ('DRAFT','APPROVED','REJECTED')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_package_prices_draft_inactive CHECK (approval_status = 'APPROVED' OR active = false)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_package_price_active ON service_package_prices(service_id, quantity) WHERE active;
CREATE INDEX IF NOT EXISTS idx_service_package_price_draft ON service_package_prices(service_id) WHERE approval_status = 'DRAFT';
CREATE INDEX IF NOT EXISTS idx_service_package_price_history ON service_package_prices(service_id, quantity, effective_from DESC);

-- ── 2. Unit cost (what one unit costs ZOHALPAY, toman) for margin display and low-margin warnings ──
CREATE TABLE IF NOT EXISTS service_unit_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  unit_cost_minor bigint NOT NULL CHECK (unit_cost_minor >= 0),
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_unit_cost_active ON service_unit_costs(service_id) WHERE active;

-- ── 3. Catalogue presentation: one-line hint and manual sort position per service ──────────────────
ALTER TABLE services ADD COLUMN IF NOT EXISTS hint text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_hint_length;
ALTER TABLE services ADD CONSTRAINT services_hint_length CHECK (hint IS NULL OR char_length(hint) <= 120);
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_sort_order_range;
ALTER TABLE services ADD CONSTRAINT services_sort_order_range CHECK (sort_order IS NULL OR sort_order BETWEEN 0 AND 100000);

-- ── 4. Internal order notes (staff only; never shown to customers) ────────────────────────────────
-- Deliberately has no workspace_id: it is platform-staff data, written and read only by admin code.
CREATE TABLE IF NOT EXISTS admin_order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_order_notes_order ON admin_order_notes(order_id, created_at);

-- ── 5. Ticket assignment ───────────────────────────────────────────────────────────────────────────
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

DROP POLICY IF EXISTS system_read ON support_tickets;
CREATE POLICY system_read ON support_tickets FOR SELECT USING (app_system_read());
DROP POLICY IF EXISTS system_read ON support_ticket_messages;
CREATE POLICY system_read ON support_ticket_messages FOR SELECT USING (app_system_read());
DROP POLICY IF EXISTS system_read ON audit_logs;
CREATE POLICY system_read ON audit_logs FOR SELECT USING (app_system_read());

-- ── 6. Read functions ──────────────────────────────────────────────────────────────────────────────

-- Orders list with search/filters. Money in toman. p_search: order code (ZP-ABC123 / hex prefix), customer
-- name/phone/e-mail or service name. p_attention: failed, refund pending, or stuck in a working status.
CREATE OR REPLACE FUNCTION system_admin_order_search(
  p_status text, p_search text, p_category text, p_user uuid, p_from timestamptz, p_to timestamptz,
  p_attention boolean, p_stale_hours integer, p_limit integer, p_offset integer)
RETURNS TABLE(order_id uuid, workspace_id uuid, status text, total_toman numeric, created_at timestamptz, updated_at timestamptz,
              owner_user_id uuid, owner_name text, owner_phone text, owner_email text, service_name text, product_slug text,
              quantity bigint, fulfillment_mode text, total_count bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  prev text := current_setting('app.rls_system_read', true);
  term text := NULLIF(btrim(COALESCE(p_search, '')), '');
  pat text;
  code text;
BEGIN
  IF term IS NOT NULL THEN
    pat := '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    code := lower(regexp_replace(term, '^zp-', '', 'i'));
    IF code !~ '^[0-9a-f]{4,32}$' THEN code := NULL; END IF;
  END IF;
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT pg.id, pg.workspace_id, pg.status::text, pg.total, pg.created_at, pg.updated_at,
           u.id, u.display_name, u.phone, u.email, it.name, it.slug, it.quantity, it.fulfillment_mode, pg.total_count
    FROM (
      SELECT o.id, o.workspace_id, o.status, o.created_at, o.updated_at,
             CASE WHEN o.currency = 'IRR' THEN o.total_minor / 10.0 ELSE o.total_minor::numeric END AS total,
             count(*) OVER () AS total_count
      FROM orders o
      JOIN workspaces w ON w.id = o.workspace_id
      JOIN users ou ON ou.id = w.owner_user_id
      WHERE (p_status IS NULL OR o.status::text = p_status)
        AND (p_user IS NULL OR w.owner_user_id = p_user)
        AND (p_from IS NULL OR o.created_at >= p_from)
        AND (p_to IS NULL OR o.created_at < p_to)
        AND (p_category IS NULL OR EXISTS (
              SELECT 1 FROM order_items oi JOIN services s ON s.id = oi.service_id JOIN products pr ON pr.id = s.product_id
              WHERE oi.order_id = o.id AND pr.slug = p_category))
        AND (NOT COALESCE(p_attention, false) OR o.status::text IN ('FAILED','REFUND_PENDING')
             OR (o.status::text IN ('PAID','QUEUED','PROCESSING','PROVIDER_SUBMITTED','IN_PROGRESS')
                 AND o.updated_at < now() - make_interval(hours => GREATEST(COALESCE(p_stale_hours, 6), 1))))
        AND (term IS NULL
             OR (code IS NOT NULL AND replace(o.id::text, '-', '') LIKE code || '%')
             OR ou.display_name ILIKE pat OR ou.phone ILIKE pat OR ou.email ILIKE pat
             OR EXISTS (SELECT 1 FROM order_items oi JOIN services s ON s.id = oi.service_id
                        WHERE oi.order_id = o.id AND s.name ILIKE pat))
      ORDER BY o.created_at DESC, o.id
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    ) pg
    LEFT JOIN workspaces w ON w.id = pg.workspace_id
    LEFT JOIN users u ON u.id = w.owner_user_id
    LEFT JOIN LATERAL (
      SELECT s.name, pr.slug, oi.quantity, s.fulfillment_mode FROM order_items oi
      JOIN services s ON s.id = oi.service_id JOIN products pr ON pr.id = s.product_id
      WHERE oi.order_id = pg.id ORDER BY oi.id LIMIT 1
    ) it ON true
    ORDER BY pg.created_at DESC, pg.id;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Routing only: which workspace owns an order / ticket. The caller then works inside that tenant.
CREATE OR REPLACE FUNCTION system_admin_order_workspace(p_order uuid)
RETURNS TABLE(workspace_id uuid, owner_user_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY SELECT o.workspace_id, w.owner_user_id FROM orders o JOIN workspaces w ON w.id = o.workspace_id WHERE o.id = p_order;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

CREATE OR REPLACE FUNCTION system_admin_ticket_workspace(p_ticket uuid)
RETURNS TABLE(workspace_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY SELECT t.workspace_id FROM support_tickets t WHERE t.id = p_ticket;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Tickets list across tenants. p_status: OPEN|ANSWERED|PENDING|CLOSED, or 'ACTIVE' = everything not closed.
-- p_assignee: NULL = anyone, 'none' = unassigned, otherwise a user id (text).
CREATE OR REPLACE FUNCTION system_admin_tickets(p_status text, p_search text, p_assignee text, p_user uuid, p_limit integer, p_offset integer)
RETURNS TABLE(ticket_id uuid, workspace_id uuid, code text, subject text, status text, category text, priority text,
              created_at timestamptz, last_message_at timestamptz, order_id uuid, customer_user_id uuid, customer_name text, customer_phone text,
              assigned_to_user_id uuid, assigned_name text, last_author text, preview text, total_count bigint)
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
    SELECT pg.id, pg.workspace_id, pg.code, pg.subject, pg.status, pg.category, pg.priority, pg.created_at, pg.last_message_at, pg.order_id,
           cu.id, cu.display_name, cu.phone, pg.assigned_to_user_id, au.display_name, lm.author_kind, lm.preview, pg.total_count
    FROM (
      SELECT t.id, t.workspace_id, t.code, t.subject, t.status, t.category, t.priority, t.created_at, t.last_message_at, t.order_id,
             t.created_by_user_id, t.assigned_to_user_id, count(*) OVER () AS total_count
      FROM support_tickets t
      LEFT JOIN users c ON c.id = t.created_by_user_id
      WHERE (p_status IS NULL OR (p_status = 'ACTIVE' AND t.status <> 'CLOSED') OR t.status = p_status)
        AND (p_user IS NULL OR t.created_by_user_id = p_user)
        AND (p_assignee IS NULL OR (p_assignee = 'none' AND t.assigned_to_user_id IS NULL) OR t.assigned_to_user_id::text = p_assignee)
        AND (pat IS NULL OR t.subject ILIKE pat OR t.code ILIKE pat OR c.display_name ILIKE pat OR c.phone ILIKE pat OR c.email ILIKE pat)
      ORDER BY (t.status = 'CLOSED'), (t.status = 'ANSWERED'), t.last_message_at DESC, t.id
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    ) pg
    LEFT JOIN users cu ON cu.id = pg.created_by_user_id
    LEFT JOIN users au ON au.id = pg.assigned_to_user_id
    LEFT JOIN LATERAL (
      SELECT left(m.body, 120) AS preview, m.author_kind FROM support_ticket_messages m
      WHERE m.ticket_id = pg.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1
    ) lm ON true
    ORDER BY (pg.status = 'CLOSED'), (pg.status = 'ANSWERED'), pg.last_message_at DESC, pg.id;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Dashboard «needs attention». metric / count / oldest timestamp; counts only.
CREATE OR REPLACE FUNCTION system_admin_attention(p_stale_hours integer)
RETURNS TABLE(metric text, row_count bigint, oldest_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE prev text := current_setting('app.rls_system_read', true); stale interval := make_interval(hours => GREATEST(COALESCE(p_stale_hours, 6), 1));
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT 'orders_failed'::text, count(*), min(o.updated_at) FROM orders o WHERE o.status::text = 'FAILED'
    UNION ALL
    SELECT 'orders_refund_pending', count(*), min(o.updated_at) FROM orders o WHERE o.status::text = 'REFUND_PENDING'
    UNION ALL
    SELECT 'orders_stale', count(*), min(o.updated_at) FROM orders o
      WHERE o.status::text IN ('PAID','QUEUED','PROCESSING','PROVIDER_SUBMITTED','IN_PROGRESS') AND o.updated_at < now() - stale
    UNION ALL
    SELECT 'orders_team_waiting', count(*), min(o.updated_at) FROM orders o
      WHERE o.status::text IN ('QUEUED','IN_PROGRESS')
        AND EXISTS (SELECT 1 FROM order_items oi JOIN services s ON s.id = oi.service_id WHERE oi.order_id = o.id AND s.fulfillment_mode = 'MANUAL')
    UNION ALL
    SELECT 'tickets_open', count(*), min(t.last_message_at) FROM support_tickets t WHERE t.status IN ('OPEN','PENDING')
    UNION ALL
    SELECT 'tickets_unassigned', count(*), min(t.last_message_at) FROM support_tickets t WHERE t.status IN ('OPEN','PENDING') AND t.assigned_to_user_id IS NULL;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Revenue per Tehran calendar day: bucket '' = all sections, otherwise the product (section) slug.
CREATE OR REPLACE FUNCTION system_admin_revenue_daily(p_days integer)
RETURNS TABLE(day date, bucket text, row_count bigint, amount_toman numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  prev text := current_setting('app.rls_system_read', true);
  since timestamptz := (date_trunc('day', now() AT TIME ZONE 'Asia/Tehran') - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 14), 1), 90) - 1)) AT TIME ZONE 'Asia/Tehran';
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT (o.created_at AT TIME ZONE 'Asia/Tehran')::date, ''::text, count(*),
           COALESCE(sum(CASE WHEN o.currency = 'IRR' THEN o.total_minor / 10.0 ELSE o.total_minor::numeric END), 0)
      FROM orders o
      WHERE o.created_at >= since AND o.status::text IN ('PAID','QUEUED','PROCESSING','PROVIDER_SUBMITTED','IN_PROGRESS','COMPLETED')
      GROUP BY 1
    UNION ALL
    SELECT (o.created_at AT TIME ZONE 'Asia/Tehran')::date, pr.slug, count(DISTINCT o.id),
           COALESCE(sum(CASE WHEN o.currency = 'IRR' THEN oi.total_minor / 10.0 ELSE oi.total_minor::numeric END), 0)
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN services s ON s.id = oi.service_id
      JOIN products pr ON pr.id = s.product_id
      WHERE o.created_at >= since AND o.status::text IN ('PAID','QUEUED','PROCESSING','PROVIDER_SUBMITTED','IN_PROGRESS','COMPLETED')
      GROUP BY 1, 2;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

-- Audit log viewer: newest first, filters are all optional.
CREATE OR REPLACE FUNCTION system_admin_audit(
  p_action text, p_entity_type text, p_actor uuid, p_entity uuid, p_from timestamptz, p_to timestamptz, p_limit integer, p_offset integer)
RETURNS TABLE(id uuid, workspace_id uuid, actor_user_id uuid, actor_name text, action text, entity_type text, entity_id uuid,
              metadata jsonb, created_at timestamptz, total_count bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  prev text := current_setting('app.rls_system_read', true);
  pat text := CASE WHEN p_action IS NULL OR btrim(p_action) = '' THEN NULL
    ELSE replace(replace(replace(btrim(p_action), '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT pg.id, pg.workspace_id, pg.actor_user_id, u.display_name, pg.action, pg.entity_type, pg.entity_id, pg.metadata, pg.created_at, pg.total_count
    FROM (
      SELECT a.id, a.workspace_id, a.actor_user_id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at, count(*) OVER () AS total_count
      FROM audit_logs a
      WHERE (pat IS NULL OR a.action ILIKE pat)
        AND (p_entity_type IS NULL OR a.entity_type = p_entity_type)
        AND (p_actor IS NULL OR a.actor_user_id = p_actor)
        AND (p_entity IS NULL OR a.entity_id = p_entity)
        AND (p_from IS NULL OR a.created_at >= p_from)
        AND (p_to IS NULL OR a.created_at < p_to)
      ORDER BY a.created_at DESC, a.id
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    ) pg
    LEFT JOIN users u ON u.id = pg.actor_user_id
    ORDER BY pg.created_at DESC, pg.id;
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;

REVOKE ALL ON FUNCTION system_admin_order_search(text, text, text, uuid, timestamptz, timestamptz, boolean, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_admin_order_workspace(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_admin_ticket_workspace(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_admin_tickets(text, text, text, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_admin_attention(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_admin_revenue_daily(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION system_admin_audit(text, text, uuid, uuid, timestamptz, timestamptz, integer, integer) FROM PUBLIC;

COMMIT;
