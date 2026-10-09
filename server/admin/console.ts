// Read side of the admin console (برنامه مدیریت). Every function repeats the platform-admin check so a
// cross-tenant read can never run for a caller that skipped the page/route gate. The orders, payments and
// wallets tables are FORCE-RLS; the data comes from the system_admin_* functions (migration 0061).
import { query } from '../core/db';
import { requirePlatformAdmin } from '../identity/platform-admin';

export type Period = 'today' | 'd7' | 'd30';
export const PERIODS: Period[] = ['today', 'd7', 'd30'];

type RevenueRow = { metric: string; period: string; bucket: string; row_count: string; amount_toman: string | null };

export type RevenueDashboard = {
  sales: Record<Period, { count: number; toman: number }>;
  topups: Record<Period, { count: number; toman: number }>;
  direct: Record<Period, { count: number; toman: number }>;
  ordersByStatus: Record<Period, Record<string, number>>;
  categories: Record<Period, Array<{ slug: string; orders: number; toman: number }>>;
};

const empty = <T,>(make: () => T): Record<Period, T> => ({ today: make(), d7: make(), d30: make() });
const isPeriod = (p: string): p is Period => (PERIODS as string[]).includes(p);

export async function getRevenueDashboard(userId: string): Promise<RevenueDashboard> {
  await requirePlatformAdmin(userId);
  const r = await query<RevenueRow>(
    `SELECT metric, period, bucket, row_count::text AS row_count, amount_toman::text AS amount_toman FROM system_admin_revenue()`,
  );
  const out: RevenueDashboard = {
    sales: empty(() => ({ count: 0, toman: 0 })),
    topups: empty(() => ({ count: 0, toman: 0 })),
    direct: empty(() => ({ count: 0, toman: 0 })),
    ordersByStatus: empty(() => ({})),
    categories: empty(() => []),
  };
  for (const row of r.rows) {
    if (!isPeriod(row.period)) continue;
    const count = Number(row.row_count);
    const toman = Math.round(Number(row.amount_toman ?? 0));
    switch (row.metric) {
      case 'sales': out.sales[row.period] = { count, toman }; break;
      case 'payments':
        if (row.bucket === 'TOPUP') out.topups[row.period] = { count, toman };
        else if (row.bucket === 'DIRECT') out.direct[row.period] = { count, toman };
        break;
      case 'orders_by_status': out.ordersByStatus[row.period][row.bucket] = count; break;
      case 'category': out.categories[row.period].push({ slug: row.bucket, orders: count, toman }); break;
    }
  }
  for (const p of PERIODS) out.categories[p].sort((a, b) => b.toman - a.toman);
  return out;
}

export const PAGE_SIZE = 25;

export type AdminOrderRow = {
  orderId: string; workspaceId: string; status: string; totalToman: number; createdAt: string;
  ownerName: string | null; ownerPhone: string | null; serviceName: string | null; productSlug: string | null; quantity: number | null;
};
export const ORDER_STATUSES = ['CREATED','PAYMENT_PENDING','PAID','QUEUED','PROCESSING','PROVIDER_SUBMITTED','IN_PROGRESS','COMPLETED','FAILED','CANCELLED','REFUND_PENDING','REFUNDED'] as const;

export function clampPage(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : 1;
}

export async function listAdminOrders(userId: string, input: { status?: string | null; page?: number }): Promise<{ rows: AdminOrderRow[]; total: number; page: number }> {
  await requirePlatformAdmin(userId);
  const status = input.status && (ORDER_STATUSES as readonly string[]).includes(input.status) ? input.status : null;
  const page = clampPage(input.page);
  const r = await query<{
    order_id: string; workspace_id: string; status: string; total_toman: string; created_at: string; owner_name: string | null;
    owner_phone: string | null; service_name: string | null; product_slug: string | null; quantity: string | null; total_count: string;
  }>(`SELECT * FROM system_admin_orders($1, $2, $3)`, [status, PAGE_SIZE, (page - 1) * PAGE_SIZE]);
  return {
    page,
    total: Number(r.rows[0]?.total_count ?? 0),
    rows: r.rows.map(x => ({
      orderId: x.order_id, workspaceId: x.workspace_id, status: x.status, totalToman: Math.round(Number(x.total_toman)), createdAt: x.created_at,
      ownerName: x.owner_name, ownerPhone: x.owner_phone, serviceName: x.service_name, productSlug: x.product_slug,
      quantity: x.quantity == null ? null : Number(x.quantity),
    })),
  };
}

export type AdminUserRow = {
  userId: string; displayName: string; email: string | null; phone: string | null; status: string; createdAt: string;
  walletToman: number; orderCount: number;
};

export async function listAdminUsers(userId: string, input: { search?: string | null; page?: number }): Promise<{ rows: AdminUserRow[]; total: number; page: number }> {
  await requirePlatformAdmin(userId);
  const search = (input.search ?? '').trim().slice(0, 80) || null;
  const page = clampPage(input.page);
  const r = await query<{
    user_id: string; display_name: string; email: string | null; phone: string | null; status: string; created_at: string;
    wallet_balance_toman: string; order_count: string; total_count: string;
  }>(`SELECT * FROM system_admin_users($1, $2, $3)`, [search, PAGE_SIZE, (page - 1) * PAGE_SIZE]);
  return {
    page,
    total: Number(r.rows[0]?.total_count ?? 0),
    rows: r.rows.map(x => ({
      userId: x.user_id, displayName: x.display_name, email: x.email, phone: x.phone, status: x.status, createdAt: x.created_at,
      walletToman: Math.round(Number(x.wallet_balance_toman)), orderCount: Number(x.order_count),
    })),
  };
}
