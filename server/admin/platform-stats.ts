import { query } from '../core/db';
import { requirePlatformAdmin } from '../identity/platform-admin';

type StatRow = { metric: string; bucket: string | null; row_count: string; amount_minor: string | null; last_at: string | null };

export type PlatformAdminStats = {
  orderMap: Record<string, number>;
  paymentMap: Record<string, { count: number; total: bigint }>;
  subMap: Record<string, number>;
  providers: Array<{ provider_id: string; status: string; latency_ms: number; checked_at: string }>;
  alertBySev: Record<string, { count: number; lastAt: string }>;
  userCount: number;
  queueTotal: number;
  orders24hCount: number;
};

const QUEUE_STATUSES = new Set(['QUEUED', 'PROCESSING', 'PROVIDER_SUBMITTED']);

/**
 * Cross-tenant aggregates for the platform-admin dashboard.
 *
 * orders, payments, subscriptions and operational_events are FORCE-RLS tables, so a plain pool query
 * sees nothing. The aggregates come from system_admin_dashboard_stats() (migration 0031), which returns
 * counts only. The platform-admin check is repeated here so this cross-tenant read can never run for a
 * caller that skipped the page-level gate.
 */
export async function getPlatformAdminStats(userId: string): Promise<PlatformAdminStats> {
  await requirePlatformAdmin(userId);

  const [stats, providers, users] = await Promise.all([
    query<StatRow>(`SELECT metric, bucket, row_count::text AS row_count, amount_minor::text AS amount_minor, last_at::text AS last_at FROM system_admin_dashboard_stats()`),
    query<{ provider_id: string; status: string; latency_ms: number; checked_at: string }>(
      `SELECT DISTINCT ON (provider_id) provider_id, status, latency_ms, checked_at
       FROM provider_health_checks ORDER BY provider_id, checked_at DESC`,
    ),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users`),
  ]);

  const orderMap: Record<string, number> = {};
  const paymentMap: Record<string, { count: number; total: bigint }> = {};
  const subMap: Record<string, number> = {};
  const alertBySev: Record<string, { count: number; lastAt: string }> = {};
  let orders24hCount = 0;

  for (const row of stats.rows) {
    const count = Number(row.row_count);
    const bucket = row.bucket ?? '';
    switch (row.metric) {
      case 'orders_by_status': orderMap[bucket] = count; break;
      case 'orders_last_24h': orders24hCount = count; break;
      case 'payments_by_status': paymentMap[bucket] = { count, total: BigInt(row.amount_minor ?? '0') }; break;
      case 'subscriptions_by_status': subMap[bucket] = count; break;
      case 'operational_events_24h_by_severity': alertBySev[bucket] = { count, lastAt: row.last_at ?? '' }; break;
    }
  }
  const queueTotal = Object.entries(orderMap).reduce((acc, [status, count]) => acc + (QUEUE_STATUSES.has(status) ? count : 0), 0);

  return {
    orderMap,
    paymentMap,
    subMap,
    providers: providers.rows,
    alertBySev,
    userCount: Number(users.rows[0]?.count ?? 0),
    queueTotal,
    orders24hCount,
  };
}
