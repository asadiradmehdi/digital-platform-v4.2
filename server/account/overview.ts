// Read models for the customer app surfaces (home, wallet, orders, account).
// Every workspace-scoped read goes through withWorkspaceTransaction so RLS applies.
import { query, withWorkspaceTransaction } from '../core/db';

export type Viewer = { userId: string; displayName: string; email: string | null; phone: string | null; workspaceId: string | null; workspaceName: string | null };

export async function getViewer(userId: string): Promise<Viewer> {
  const r = await query<{ displayName: string; email: string | null; phone: string | null; workspaceId: string | null; workspaceName: string | null }>(
    `SELECT COALESCE(NULLIF(u.display_name,''), split_part(u.email,'@',1), 'کاربر') AS "displayName",
            u.email, u.phone, m.workspace_id AS "workspaceId", m.name AS "workspaceName"
     FROM users u
     LEFT JOIN LATERAL (
       SELECT wm.workspace_id, w.name FROM workspace_members wm JOIN workspaces w ON w.id=wm.workspace_id
       WHERE wm.user_id=u.id AND wm.status='ACTIVE' ORDER BY wm.created_at LIMIT 1
     ) m ON true
     WHERE u.id=$1`,
    [userId],
  );
  const row = r.rows[0];
  return { userId, displayName: row?.displayName ?? 'کاربر', email: row?.email ?? null, phone: row?.phone ?? null, workspaceId: row?.workspaceId ?? null, workspaceName: row?.workspaceName ?? null };
}

export type WalletEntry = { id: string; direction: 'CREDIT' | 'DEBIT'; amountMinor: string; currency: string; referenceType: string; label: string | null; createdAt: string };
export type WalletSummary = { walletId: string; currency: string; balanceMinor: string; entries: WalletEntry[] };

export async function getWalletSummary(workspaceId: string, entryLimit = 20): Promise<WalletSummary | null> {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const w = await client.query<{ walletId: string; currency: string; balanceMinor: string }>(
      `SELECT w.id AS "walletId", w.currency,
              COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE -le.amount_minor END),0)::text AS "balanceMinor"
       FROM wallets w
       LEFT JOIN ledger_accounts la ON la.wallet_id=w.id
       LEFT JOIN ledger_entries le ON le.account_id=la.id
       WHERE w.workspace_id=$1
       GROUP BY w.id, w.currency
       ORDER BY w.created_at LIMIT 1`,
      [workspaceId],
    );
    const wallet = w.rows[0];
    if (!wallet) return null;
    const e = await client.query<WalletEntry>(
      `SELECT le.id, le.direction, le.amount_minor::text AS "amountMinor", le.currency,
              le.reference_type AS "referenceType", le.metadata->>'label' AS label, le.created_at AS "createdAt"
       FROM ledger_entries le JOIN ledger_accounts la ON la.id=le.account_id
       WHERE la.wallet_id=$1
       ORDER BY le.created_at DESC LIMIT $2`,
      [wallet.walletId, entryLimit],
    );
    return { ...wallet, entries: e.rows };
  });
}

export type OrderCard = {
  id: string; status: string; currency: string; totalMinor: string; createdAt: string;
  serviceName: string | null; serviceSlug: string | null; productSlug: string | null; quantity: string | null;
};

export const ACTIVE_ORDER_STATUSES = ['CREATED', 'PAYMENT_PENDING', 'PAID', 'QUEUED', 'PROCESSING', 'PROVIDER_SUBMITTED', 'IN_PROGRESS'] as const;

/** Newest-first order cards with their first line item, for list and summary surfaces. */
export async function listOrderCards(workspaceId: string, opts: { limit: number; offset?: number; activeOnly?: boolean }) {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const where = opts.activeOnly ? `AND o.status::text = ANY($4::text[])` : '';
    const params: unknown[] = [workspaceId, opts.limit + 1, opts.offset ?? 0];
    if (opts.activeOnly) params.push([...ACTIVE_ORDER_STATUSES]);
    const r = await client.query<OrderCard>(
      `SELECT o.id, o.status, o.currency, o.total_minor::text AS "totalMinor", o.created_at AS "createdAt",
              it.name AS "serviceName", it.slug AS "serviceSlug", it.product_slug AS "productSlug", it.quantity::text AS quantity
       FROM orders o
       LEFT JOIN LATERAL (
         SELECT s.name, s.slug, p.slug AS product_slug, oi.quantity
         FROM order_items oi JOIN services s ON s.id=oi.service_id JOIN products p ON p.id=s.product_id
         WHERE oi.order_id=o.id ORDER BY oi.id LIMIT 1
       ) it ON true
       WHERE o.workspace_id=$1 ${where}
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      params,
    );
    return { items: r.rows.slice(0, opts.limit), hasMore: r.rows.length > opts.limit };
  });
}

export type AccountStats = { totalOrders: number; activeOrders: number; spentToman: number };

/** Order counts and lifetime paid spend (toman) from paid wallet/gateway payments. */
export async function getAccountStats(workspaceId: string): Promise<AccountStats> {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const r = await client.query<{ total: string; active: string; spent: string }>(
      `SELECT
         (SELECT COUNT(*) FROM orders WHERE workspace_id=$1)::text AS total,
         (SELECT COUNT(*) FROM orders WHERE workspace_id=$1 AND status::text = ANY($2::text[]))::text AS active,
         (SELECT COALESCE(SUM(CASE WHEN currency='IRR' THEN amount_minor/10 ELSE amount_minor END),0)
            FROM payments WHERE workspace_id=$1 AND status='PAID' AND order_id IS NOT NULL)::text AS spent`,
      [workspaceId, [...ACTIVE_ORDER_STATUSES]],
    );
    const row = r.rows[0];
    return { totalOrders: Number(row?.total ?? 0), activeOrders: Number(row?.active ?? 0), spentToman: Number(row?.spent ?? 0) };
  });
}

export type CatalogItem = {
  id: string; slug: string; name: string; description: string | null; productSlug: string;
  unitPriceMinor: string | null; currency: string | null; minQuantity: string | null; maxQuantity: string | null;
};

/** Active services with their current IRT unit price — the same price row createOrder charges. */
export async function listCatalogWithPrices(productSlug?: string): Promise<CatalogItem[]> {
  const r = await query<CatalogItem>(
    `SELECT s.id, s.slug, s.name, s.description, p.slug AS "productSlug",
            pr.unit_price_minor::text AS "unitPriceMinor", pr.currency,
            pr.min_quantity::text AS "minQuantity", pr.max_quantity::text AS "maxQuantity"
     FROM services s JOIN products p ON p.id=s.product_id
     LEFT JOIN LATERAL (
       SELECT sp.unit_price_minor, sp.currency, sp.min_quantity, sp.max_quantity FROM service_prices sp
       WHERE sp.service_id=s.id AND sp.active=true AND sp.currency='IRT'
         AND (sp.effective_to IS NULL OR sp.effective_to > now())
       ORDER BY sp.effective_from DESC LIMIT 1
     ) pr ON true
     WHERE s.active=true AND ($1::text IS NULL OR p.slug=$1)
     ORDER BY p.slug, s.slug`,
    [productSlug ?? null],
  );
  return r.rows;
}

/** Whether the user has an enabled second factor (for the account screen's security row). */
export async function hasEnabledMfa(userId: string): Promise<boolean> {
  const r = await query<{ on: boolean }>(`SELECT EXISTS(SELECT 1 FROM mfa_methods WHERE user_id=$1 AND enabled=true) AS on`, [userId]);
  return Boolean(r.rows[0]?.on);
}
