import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withUserTransaction: vi.fn(async (_u: string, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});
import { writeAudit } from '../../server/core/audit';
import { query } from '../../server/core/db';
import { createVariant } from '../../server/admin/catalog-meta';

const A = '11111111-1111-4111-8111-111111111111';
const BASE = '10000000-0000-0000-0000-000000000001';
const q = vi.mocked(query);
beforeEach(() => vi.resetAllMocks());

describe('createVariant', () => {
  it('creates <base>--<variant>, copies params/routes and starts as an inactive DRAFT price, audited', async () => {
    q.mockImplementation((async (sql: string) => {
      if (/FROM services WHERE id/.test(sql)) return { rows: [{ id: BASE, product_id: 'p', name: 'فالوور اینستاگرام', slug: 'ig-followers', service_type: 'X', description: null }] };
      if (/INSERT INTO services/.test(sql)) return { rows: [{ id: 'new-id' }] };
      return { rows: [] };
    }) as never);
    const r = await createVariant({ actorUserId: A, baseServiceId: BASE, variant: 'iranian' });
    expect(r).toEqual({ id: 'new-id', slug: 'ig-followers--iranian' });
    const sqls = q.mock.calls.map(c => String(c[0]));
    expect(sqls.some(s => /INSERT INTO service_prices/.test(s) && /false, 'DRAFT'/.test(s))).toBe(true);
    expect(sqls.some(s => /INSERT INTO provider_routes/.test(s))).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.service.variant.create' }), expect.anything());
  });
  it('rejects unknown variants, variants of variants, and duplicates', async () => {
    await expect(createVariant({ actorUserId: A, baseServiceId: BASE, variant: 'weird' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    q.mockResolvedValueOnce({ rows: [{ id: BASE, product_id: 'p', name: 'n', slug: 'ig-followers--foreign', service_type: 'X', description: null }] } as never);
    await expect(createVariant({ actorUserId: A, baseServiceId: BASE, variant: 'iranian' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    q.mockResolvedValueOnce({ rows: [{ id: BASE, product_id: 'p', name: 'n', slug: 'ig-followers', service_type: 'X', description: null }] } as never).mockResolvedValueOnce({ rows: [] } as never);
    await expect(createVariant({ actorUserId: A, baseServiceId: BASE, variant: 'iranian' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
