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
import { approvePrice, createDraftPrice, listAdminServices, setServiceActive } from '../../server/admin/catalog';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const SVC = '10000000-0000-0000-0000-000000000001';
const PRICE = '33333333-3333-4333-8333-333333333333';
const mockQuery = vi.mocked(query);
const sqls = () => mockQuery.mock.calls.map(c => String(c[0]));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestUser).mockResolvedValue(ADMIN as never);
});

describe('createDraftPrice', () => {
  it('inserts an INACTIVE draft row, never updates an existing price amount, and audits it', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: SVC }] } as never)
      .mockResolvedValueOnce({ rows: [{ unit_price_minor: '180', price_version: '2' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: PRICE }] } as never);
    const r = await createDraftPrice({ actorUserId: ADMIN, serviceId: SVC, unitToman: '250', min: 100, max: '' });
    expect(r).toEqual({ id: PRICE });
    const insert = mockQuery.mock.calls.find(c => /INSERT INTO service_prices/.test(String(c[0])))!;
    expect(String(insert[0])).toMatch(/false,'DRAFT'/);
    expect(insert[1]).toEqual([SVC, 'IRT', 250, 100, null, ADMIN, 3]);
    expect(sqls().some(s => /UPDATE service_prices SET unit_price_minor/.test(s))).toBe(false);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.price.draft', entityId: PRICE }), expect.anything());
  });

  it.each([[0], [-5], [1.5], ['abc'], [1e12]])('rejects unit price %s', async v => {
    await expect(createDraftPrice({ actorUserId: ADMIN, serviceId: SVC, unitToman: v })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects max below min and non-admins', async () => {
    await expect(createDraftPrice({ actorUserId: ADMIN, serviceId: SVC, unitToman: 5, min: 10, max: 5 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new AppError('FORBIDDEN', 'x'));
    await expect(createDraftPrice({ actorUserId: ADMIN, serviceId: SVC, unitToman: 5 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('approvePrice', () => {
  it('closes the active row and activates the draft in one transaction with an audit row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: PRICE, service_id: SVC, currency: 'IRT', unit_price_minor: '250', approval_status: 'DRAFT', active: false, approved_at: null }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'old', unit_price_minor: '180' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    expect(await approvePrice({ actorUserId: ADMIN, priceId: PRICE })).toEqual({ id: PRICE, swapped: true });
    const s = sqls();
    expect(s[1]).toMatch(/SET active=false, effective_to=now\(\)/);
    expect(s[2]).toMatch(/SET active=true, approval_status='APPROVED', effective_from=now\(\)/);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin.price.approve', metadata: expect.objectContaining({ fromToman: 180, toToman: 250, previousPriceId: 'old' }),
    }), expect.anything());
  });

  it('only stamps a seeded, unconfirmed active price without touching the amount', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: PRICE, service_id: SVC, currency: 'IRT', unit_price_minor: '9', approval_status: 'APPROVED', active: true, approved_at: null }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    expect(await approvePrice({ actorUserId: ADMIN, priceId: PRICE })).toEqual({ id: PRICE, swapped: false });
    expect(sqls()[1]).toMatch(/SET approved_at=now\(\)/);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.price.confirm' }), expect.anything());
  });

  it('refuses rejected or already-approved prices and unknown ids', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: PRICE, service_id: SVC, currency: 'IRT', unit_price_minor: '9', approval_status: 'REJECTED', active: false, approved_at: null }] } as never);
    await expect(approvePrice({ actorUserId: ADMIN, priceId: PRICE })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    await expect(approvePrice({ actorUserId: ADMIN, priceId: PRICE })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(vi.mocked(writeAudit)).not.toHaveBeenCalled();
  });
});

describe('setServiceActive / listAdminServices', () => {
  it('audits only real changes', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ was: true }] } as never);
    await setServiceActive({ actorUserId: ADMIN, serviceId: SVC, active: false });
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.service.disable' }), expect.anything());
    vi.mocked(writeAudit).mockClear();
    mockQuery.mockResolvedValueOnce({ rows: [{ was: false }] } as never);
    await setServiceActive({ actorUserId: ADMIN, serviceId: SVC, active: false });
    expect(vi.mocked(writeAudit)).not.toHaveBeenCalled();
  });

  it('maps rows with current price, confirmation state and open draft', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{
      id: SVC, name: 'فالوور', slug: 'ig-followers', product_slug: 'instagram', product_name: 'اینستاگرام', active: true, fulfillment_mode: 'PROVIDER',
      p_id: 'p1', p_unit: '180', p_min: '100', p_max: null, p_since: '2026-10-01', p_confirmed: false,
      d_id: 'd1', d_unit: '200', d_min: null, d_max: null, d_created: '2026-10-09',
    }] } as never);
    const [row] = await listAdminServices(ADMIN);
    expect(row.price).toMatchObject({ unitToman: 180, min: 100, max: null, confirmed: false });
    expect(row.draft).toMatchObject({ id: 'd1', unitToman: 200 });
  });
});

type PricesRoute = typeof import('../../app/api/v1/admin/catalog/prices/route');
type PriceRoute = typeof import('../../app/api/v1/admin/catalog/prices/[id]/route');
type SvcRoute = typeof import('../../app/api/v1/admin/catalog/services/[id]/route');
let createPOST: PricesRoute['POST']; let actPOST: PriceRoute['POST']; let svcPOST: SvcRoute['POST'];
beforeAll(async () => {
  createPOST = (await import('../../app/api/v1/admin/catalog/prices/route')).POST;
  actPOST = (await import('../../app/api/v1/admin/catalog/prices/[id]/route')).POST;
  svcPOST = (await import('../../app/api/v1/admin/catalog/services/[id]/route')).POST;
}, 60000);
const req = (body: unknown) => ({ headers: { get: () => null }, url: 'http://localhost:3000/x', method: 'POST', json: async () => body }) as never;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('admin catalog routes', () => {
  it('enforce same-origin, admin role and input validation before any write', async () => {
    vi.mocked(assertSameOrigin).mockImplementationOnce(() => { throw new AppError('FORBIDDEN', 'cross'); });
    expect((await createPOST(req({ serviceId: SVC, unitToman: 5 }))).status).toBe(403);
    vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new AppError('FORBIDDEN', 'x'));
    expect((await actPOST(req({ action: 'approve' }), ctx(PRICE))).status).toBe(403);
    expect((await createPOST(req({ serviceId: 'nope', unitToman: 5 }))).status).toBe(400);
    expect((await actPOST(req({ action: 'delete' }), ctx(PRICE))).status).toBe(400);
    expect((await svcPOST(req({ active: 'yes' }), ctx(SVC))).status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('creates a draft (201) and approves it (200)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: SVC }] } as never).mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never).mockResolvedValueOnce({ rows: [{ id: PRICE }] } as never);
    const created = await createPOST(req({ serviceId: SVC, unitToman: 250 }));
    expect(created.status).toBe(201);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: PRICE, service_id: SVC, currency: 'IRT', unit_price_minor: '250', approval_status: 'DRAFT', active: false, approved_at: null }] } as never)
      .mockResolvedValue({ rows: [] } as never);
    expect((await actPOST(req({ action: 'approve' }), ctx(PRICE))).status).toBe(200);
  });
});
