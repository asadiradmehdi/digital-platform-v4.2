// Dashboard reads: what needs attention, revenue per day and per section. Cross-tenant data comes from the
// system_admin_* SQL functions (migrations 0061/0064); every function here repeats the platform-admin check.
import { query } from '../core/db';
import { requireAdminAccess, requirePermission } from './access';

export const STALE_HOURS = 6;

export type AttentionItem = { count: number; oldestAt: string | null };
export type Attention = {
  ordersFailed: AttentionItem; ordersRefundPending: AttentionItem; ordersStale: AttentionItem; ordersTeamWaiting: AttentionItem;
  ticketsOpen: AttentionItem; ticketsUnassigned: AttentionItem;
};
const none = (): AttentionItem => ({ count: 0, oldestAt: null });

export async function getAttention(userId: string, staleHours = STALE_HOURS): Promise<Attention> {
  const access = await requireAdminAccess(userId);
  const r = await query<{ metric: string; row_count: string; oldest_at: string | null }>(
    `SELECT metric, row_count::text, oldest_at::text FROM system_admin_attention($1)`, [staleHours]);
  const out: Attention = { ordersFailed: none(), ordersRefundPending: none(), ordersStale: none(), ordersTeamWaiting: none(), ticketsOpen: none(), ticketsUnassigned: none() };
  const map: Record<string, keyof Attention> = {
    orders_failed: 'ordersFailed', orders_refund_pending: 'ordersRefundPending', orders_stale: 'ordersStale', orders_team_waiting: 'ordersTeamWaiting',
    tickets_open: 'ticketsOpen', tickets_unassigned: 'ticketsUnassigned',
  };
  for (const row of r.rows) { const k = map[row.metric];
    // staff only see counts for the areas they may open
    if (k && (k.startsWith('orders') ? access.permissions.has('orders.view') : access.permissions.has('support.view'))) out[k] = { count: Number(row.row_count), oldestAt: row.oldest_at }; }
  return out;
}

/** Counts shown on the navigation: orders that need a decision, tickets waiting for staff. */
export async function getNavBadges(userId: string): Promise<{ orders: number; tickets: number }> {
  const a = await getAttention(userId);
  return { orders: a.ordersFailed.count + a.ordersRefundPending.count + a.ordersStale.count, tickets: a.ticketsOpen.count };
}

export type DailyRevenue = { date: string; toman: number; count: number; byCategory: Record<string, { toman: number; count: number }> };

/** The last `days` Tehran calendar days (oldest first), zero-filled, with the per-section split of each day. */
export async function getDailyRevenue(userId: string, days = 14): Promise<DailyRevenue[]> {
  await requirePermission(userId, 'orders.view');
  const n = Math.min(Math.max(Math.trunc(days) || 14, 1), 90);
  const r = await query<{ day: string; bucket: string; row_count: string; amount_toman: string }>(
    `SELECT day::text, bucket, row_count::text, amount_toman::text FROM system_admin_revenue_daily($1)`, [n]);
  const byDay = new Map<string, DailyRevenue>();
  for (const row of r.rows) {
    const d = byDay.get(row.day) ?? { date: row.day, toman: 0, count: 0, byCategory: {} };
    if (row.bucket === '') { d.toman = Math.round(Number(row.amount_toman)); d.count = Number(row.row_count); }
    else d.byCategory[row.bucket] = { toman: Math.round(Number(row.amount_toman)), count: Number(row.row_count) };
    byDay.set(row.day, d);
  }
  // Zero-fill by walking back from today in Asia/Tehran (+03:30 all year since 2022 DST abolition).
  const out: DailyRevenue[] = [];
  const tehranToday = new Date(Date.now() + 3.5 * 3600_000);
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(tehranToday.getUTCFullYear(), tehranToday.getUTCMonth(), tehranToday.getUTCDate() - i));
    const key = dt.toISOString().slice(0, 10);
    out.push(byDay.get(key) ?? { date: key, toman: 0, count: 0, byCategory: {} });
  }
  return out;
}
