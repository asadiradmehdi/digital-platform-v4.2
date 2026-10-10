import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({ assertSameOrigin: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withUserTransaction: vi.fn(async (_u: string, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});

import { requireRequestUser } from '../../server/identity/request-user';
import { requirePlatformAdmin } from '../../server/identity/platform-admin';
import { assertSameOrigin } from '../../server/core/security-boundary';
import { writeAudit } from '../../server/core/audit';
import { query } from '../../server/core/db';
import { AppError } from '../../server/core/errors';
import { applyBulk, approveAllDrafts, previewBulk, revertPrice, setPriceNow } from '../../server/admin/catalog';
import { bulkNewUnit, parseToman } from '../../lib/admin-pricing';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const SVC = '10000000-0000-0000-0000-000000000001';
const mockQuery = vi.mocked(query);
const sqls = () => mockQuery.mock.calls.map(c => String(c[0]));
beforeEach(() => { vi.resetAllMocks(); vi.mocked(requireRequestUser).mockResolvedValue(ADMIN as never); });

describe('pricing helpers', () => {
  it('parses Persian/Arabic digits and separators, rejects junk', () => {
    expect(parseToman('۱٬۲۰۰')).toBe(1200);
    expect(parseToman('1,500')).toBe(1500);
    expect(parseToman('٣٠')).toBe(30);
    expect([parseToman(''), parseToman('0'), parseToman('12.5'), parseToman('abc'), parseToman('-5')]).toEqual([null, null, null, null, null]);
  });
  it('applies percent, rounds the pack price and keeps whole-toman unit prices >= 1', () => {
    expect(bulkNewUnit(180, 10, 0, 1000)).toBe(198);
    expect(bulkNewUnit(180, 10, 1000, 1000)).toBe(198);
    expect(bulkNewUnit(35000, 10, 1000, 1)).toBe(39000);
    expect(bulkNewUnit(35000, 10, 100, 1)).toBe(38500);
    expect(bulkNewUnit(1, -90, 0, 1)).toBe(1);
  });
});

describe('setPriceNow', () => {
  it('closes the current row, rejects open drafts and inserts a NEW approved row (no amount update)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SVC }] } as never)
      .mockResolvedValueOnce({ rows: [{ unit_price_minor: '180' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'old', unit_price_minor: '180', price_version: '2' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'new' }] } as never);
    expect(await setPriceNow({ actorUserId: ADMIN, serviceId: SVC, unitToman: 200 })).toEqual({ id: 'new' });
    const s = sqls();
    expect(s[2]).toMatch(/SET active=false, effective_to=now\(\)/);
    expect(s[4]).toMatch(/INSERT INTO service_prices/);
    expect(s.some(x => /SET unit_price_minor/.test(x))).toBe(false);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.price.set', metadata: expect.objectContaining({ fromToman: 180, toToman: 200 }) }), expect.anything());
  });
  it('refuses an unchanged price and invalid input', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SVC }] } as never).mockResolvedValueOnce({ rows: [{ unit_price_minor: '200' }] } as never);
    await expect(setPriceNow({ actorUserId: ADMIN, serviceId: SVC, unitToman: 200 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(setPriceNow({ actorUserId: ADMIN, serviceId: SVC, unitToman: 0 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('revertPrice', () => {
  it('re-inserts the previous price as a new row and audits the revert', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SVC }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'cur' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'prev', unit_price_minor: '180', min_quantity: '100', max_quantity: null }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'cur', unit_price_minor: '250', price_version: '3' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never).mockResolvedValueOnce({ rows: [{ id: 'new' }] } as never);
    expect(await revertPrice({ actorUserId: ADMIN, serviceId: SVC })).toEqual({ id: 'new', unitToman: 180 });
    expect(mockQuery.mock.calls.find(c => /INSERT INTO service_prices/.test(String(c[0])))![1]).toEqual([SVC, 'IRT', 180, 100, null, ADMIN, 4]);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.price.revert', metadata: expect.objectContaining({ revertedToPriceId: 'prev' }) }), expect.anything());
  });
  it('fails clearly when there is no previous price', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SVC }] } as never).mockResolvedValueOnce({ rows: [{ id: 'cur' }] } as never).mockResolvedValueOnce({ rows: [] } as never);
    await expect(revertPrice({ actorUserId: ADMIN, serviceId: SVC })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('bulk tools', () => {
  const planRows = [{ id: SVC, name: 'فالوور', slug: 'ig-followers', unit_price_minor: '180' }, { id: 'b', name: 'لایک', slug: 'ig-likes', unit_price_minor: '1' }];
  it('previews old→new without writing, skipping unchanged prices', async () => {
    mockQuery.mockResolvedValueOnce({ rows: planRows } as never);
    const r = await previewBulk({ actorUserId: ADMIN, productSlug: 'instagram', percent: 10 });
    expect(r.rows).toEqual([expect.objectContaining({ serviceId: SVC, oldUnit: 180, newUnit: 198 })]);
    expect(writeAudit).not.toHaveBeenCalled();
  });
  it('rejects bad slug / percent / rounding', async () => {
    await expect(previewBulk({ actorUserId: ADMIN, productSlug: 'a b', percent: 10 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(previewBulk({ actorUserId: ADMIN, productSlug: 'instagram', percent: 500 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(previewBulk({ actorUserId: ADMIN, productSlug: 'instagram', percent: 5, roundTo: 7 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('applies every change in one transaction: one undoable batch per service, summary audit with a group id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: planRows } as never).mockImplementation((async (sql: string) => {
      if (/FROM services WHERE id=\$1 FOR UPDATE|SELECT slug FROM services/.test(sql)) return { rows: [{ slug: 'ig-followers' }] };
      if (/FROM service_prices\s+WHERE service_id=\$1 AND currency=\$2 AND active=true AND \(effective_to/.test(sql)) return { rows: [{ id: 'cur', unit_price_minor: '180', min_quantity: '100', max_quantity: null }] };
      if (/INSERT INTO service_price_batches/.test(sql)) return { rows: [{ id: 'batch-1' }] };
      if (/RETURNING id, unit_price_minor/.test(sql)) return { rows: [{ id: 'old', unit_price_minor: '180', price_version: '1' }] };
      if (/INSERT INTO service_prices/.test(sql)) return { rows: [{ id: 'new' }] };
      return { rows: [] };
    }) as never);
    const r = await applyBulk({ actorUserId: ADMIN, productSlug: 'instagram', percent: 10 });
    expect(r.count).toBe(1);
    expect(r.groupId).toMatch(/^[0-9a-f-]{36}$/);
    const batch = mockQuery.mock.calls.find(c => /INSERT INTO service_price_batches/.test(String(c[0])))!;
    expect(batch[1]![1]).toBe('BULK');
    expect(JSON.parse(String(batch[1]![3]))).toMatchObject({ unit: 180 });
    expect(JSON.parse(String(batch[1]![4]))).toMatchObject({ unit: 198 });
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.price.bulk', metadata: expect.objectContaining({ count: 1, percent: 10 }) }), expect.anything());
  });
  it('approves all drafts and audits the count', async () => {
    const draft = { id: 'd1', service_id: SVC, currency: 'IRT', unit_price_minor: '250', approval_status: 'DRAFT', active: false, approved_at: null };
    mockQuery.mockResolvedValueOnce({ rows: [draft] } as never).mockResolvedValueOnce({ rows: [{ id: 'old', unit_price_minor: '180' }] } as never).mockResolvedValue({ rows: [] } as never);
    expect(await approveAllDrafts({ actorUserId: ADMIN, productSlug: 'instagram' })).toEqual({ count: 1 });
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.price.approve_all' }), expect.anything());
  });
});

type Bulk = typeof import('../../app/api/v1/admin/catalog/prices/bulk/route');
type Apply = typeof import('../../app/api/v1/admin/catalog/prices/apply/route');
type Svc = typeof import('../../app/api/v1/admin/catalog/services/[id]/route');
let bulk: Bulk['POST']; let apply: Apply['POST']; let svc: Svc['POST'];
beforeAll(async () => {
  bulk = (await import('../../app/api/v1/admin/catalog/prices/bulk/route')).POST;
  apply = (await import('../../app/api/v1/admin/catalog/prices/apply/route')).POST;
  svc = (await import('../../app/api/v1/admin/catalog/services/[id]/route')).POST;
}, 60000);
const req = (body: unknown) => ({ headers: { get: () => null }, url: 'http://localhost:3000/x', method: 'POST', json: async () => body }) as never;

describe('pricing routes', () => {
  it('guard origin, admin role and input before writing', async () => {
    vi.mocked(assertSameOrigin).mockImplementationOnce(() => { throw new AppError('FORBIDDEN', 'x'); });
    expect((await apply(req({ serviceId: SVC, unitToman: 5 }))).status).toBe(403);
    vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new AppError('FORBIDDEN', 'x'));
    expect((await bulk(req({ mode: 'apply' }))).status).toBe(403);
    expect((await bulk(req({ mode: 'nope' }))).status).toBe(400);
    expect((await bulk(req({ mode: 'approve-drafts', productSlug: 'a;b' }))).status).toBe(400);
    expect((await apply(req({ serviceId: 'x', unitToman: 5 }))).status).toBe(400);
    expect((await svc(req({ action: 'revert' }), { params: Promise.resolve({ id: 'bad' }) })).status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
