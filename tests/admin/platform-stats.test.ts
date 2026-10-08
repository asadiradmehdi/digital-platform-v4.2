import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn() }));

import { query } from '../../server/core/db';
import { requirePlatformAdmin } from '../../server/identity/platform-admin';
import { AppError } from '../../server/core/errors';
import { getPlatformAdminStats } from '../../server/admin/platform-stats';

const mockQuery = vi.mocked(query);
const mockRequireAdmin = vi.mocked(requirePlatformAdmin);

beforeEach(() => vi.resetAllMocks());

function answer(sqlToRows: Array<[RegExp, unknown[]]>) {
  mockQuery.mockImplementation((async (sql: string) => {
    const hit = sqlToRows.find(([re]) => re.test(sql));
    return { rows: hit ? hit[1] : [], rowCount: hit ? hit[1].length : 0 };
  }) as never);
}

// Regression: the /admin page aggregated orders, payments, subscriptions and operational_events with
// plain-pool queries; under the production (non-superuser) role FORCE RLS made every count 0.
describe('getPlatformAdminStats', () => {
  it('reads the cross-tenant aggregates only through system_admin_dashboard_stats()', async () => {
    answer([
      [/system_admin_dashboard_stats\(\)/, [
        { metric: 'orders_by_status', bucket: 'QUEUED', row_count: '3', amount_minor: null, last_at: null },
        { metric: 'orders_by_status', bucket: 'COMPLETED', row_count: '7', amount_minor: null, last_at: null },
        { metric: 'orders_by_status', bucket: 'PROCESSING', row_count: '2', amount_minor: null, last_at: null },
        { metric: 'orders_last_24h', bucket: null, row_count: '4', amount_minor: null, last_at: null },
        { metric: 'payments_by_status', bucket: 'PAID', row_count: '5', amount_minor: '125000', last_at: null },
        { metric: 'subscriptions_by_status', bucket: 'ACTIVE', row_count: '6', amount_minor: null, last_at: null },
        { metric: 'operational_events_24h_by_severity', bucket: 'CRITICAL', row_count: '1', amount_minor: null, last_at: '2026-10-08 06:00:00+00' },
      ]],
      [/FROM users/, [{ count: '9' }]],
    ]);

    const stats = await getPlatformAdminStats('admin-1');

    expect(stats.orderMap).toEqual({ QUEUED: 3, COMPLETED: 7, PROCESSING: 2 });
    expect(stats.queueTotal).toBe(5);
    expect(stats.orders24hCount).toBe(4);
    expect(stats.paymentMap.PAID).toEqual({ count: 5, total: 125000n });
    expect(stats.subMap).toEqual({ ACTIVE: 6 });
    expect(stats.alertBySev.CRITICAL).toEqual({ count: 1, lastAt: '2026-10-08 06:00:00+00' });
    expect(stats.userCount).toBe(9);
    for (const [sql] of mockQuery.mock.calls as Array<[string]>) {
      expect(sql).not.toMatch(/FROM (orders|payments|subscriptions|operational_events)\b/);
    }
  });

  it('refuses to run the cross-tenant read for a non-admin', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Platform admin required.'));
    await expect(getPlatformAdminStats('user-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
