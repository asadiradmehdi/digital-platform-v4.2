import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn() }));

import { query } from '../../server/core/db';
import { requirePlatformAdmin } from '../../server/identity/platform-admin';
import { AppError } from '../../server/core/errors';
import { clampPage, getRevenueDashboard, listAdminOrders, listAdminUsers } from '../../server/admin/console';

const mockQuery = vi.mocked(query);
const mockAdmin = vi.mocked(requirePlatformAdmin);
beforeEach(() => vi.resetAllMocks());

describe('admin console reads', () => {
  it('refuses every read for a non-admin before touching the database', async () => {
    mockAdmin.mockRejectedValue(new AppError('FORBIDDEN', 'no'));
    await expect(getRevenueDashboard('u')).rejects.toThrow();
    await expect(listAdminOrders('u', {})).rejects.toThrow();
    await expect(listAdminUsers('u', {})).rejects.toThrow();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('folds system_admin_revenue() rows into per-period totals, top-ups vs direct and sorted categories', async () => {
    mockQuery.mockResolvedValue({ rows: [
      { metric: 'sales', period: 'today', bucket: '', row_count: '2', amount_toman: '300000' },
      { metric: 'sales', period: 'd30', bucket: '', row_count: '9', amount_toman: '1200000.4' },
      { metric: 'payments', period: 'd30', bucket: 'TOPUP', row_count: '3', amount_toman: '500000' },
      { metric: 'payments', period: 'd30', bucket: 'DIRECT', row_count: '1', amount_toman: '90000' },
      { metric: 'orders_by_status', period: 'd30', bucket: 'COMPLETED', row_count: '7', amount_toman: null },
      { metric: 'category', period: 'd30', bucket: 'telegram', row_count: '2', amount_toman: '100' },
      { metric: 'category', period: 'd30', bucket: 'instagram', row_count: '5', amount_toman: '900' },
      { metric: 'sales', period: 'weird', bucket: '', row_count: '1', amount_toman: '1' },
    ] } as never);
    const d = await getRevenueDashboard('admin');
    expect(mockQuery.mock.calls[0][0]).toMatch(/system_admin_revenue\(\)/);
    expect(d.sales.today).toEqual({ count: 2, toman: 300000 });
    expect(d.sales.d30.toman).toBe(1200000);
    expect(d.sales.d7).toEqual({ count: 0, toman: 0 });
    expect(d.topups.d30.toman).toBe(500000);
    expect(d.direct.d30.count).toBe(1);
    expect(d.ordersByStatus.d30.COMPLETED).toBe(7);
    expect(d.categories.d30.map(c => c.slug)).toEqual(['instagram', 'telegram']);
  });

  it('pages orders through system_admin_orders and ignores an unknown status filter', async () => {
    mockQuery.mockResolvedValue({ rows: [{
      order_id: 'o1', workspace_id: 'w1', status: 'QUEUED', total_toman: '150000.0', created_at: '2026-10-09T10:00:00Z',
      owner_name: 'علی', owner_phone: '+989121111111', service_name: 'فالوور', product_slug: 'instagram', quantity: '1000', total_count: '41',
    }] } as never);
    const r = await listAdminOrders('admin', { status: 'DROP TABLE', page: 3 });
    expect(mockQuery.mock.calls[0][1]).toEqual([null, 25, 50]);
    expect(r.total).toBe(41);
    expect(r.rows[0]).toMatchObject({ orderId: 'o1', totalToman: 150000, quantity: 1000, productSlug: 'instagram' });
    await listAdminOrders('admin', { status: 'COMPLETED' });
    expect(mockQuery.mock.calls[1][1]).toEqual(['COMPLETED', 25, 0]);
  });

  it('passes the user search as a bound parameter and maps balance and order count', async () => {
    mockQuery.mockResolvedValue({ rows: [{
      user_id: 'u1', display_name: 'سارا', email: null, phone: '+989122222222', status: 'ACTIVE', created_at: '2026-10-01T00:00:00Z',
      wallet_balance_toman: '500000.000', order_count: '4', total_count: '1',
    }] } as never);
    const r = await listAdminUsers('admin', { search: "  %'; DROP--  " });
    expect(mockQuery.mock.calls[0][1]).toEqual(["%'; DROP--", 25, 0]);
    expect(r.rows[0]).toMatchObject({ userId: 'u1', walletToman: 500000, orderCount: 4 });
  });

  it('clamps page numbers', () => {
    expect([clampPage('x'), clampPage(0), clampPage(-3), clampPage(2.5), clampPage('4')]).toEqual([1, 1, 1, 1, 4]);
  });
});
