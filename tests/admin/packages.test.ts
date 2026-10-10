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
import { diffStates, marginPct, planPackageEdit, previewPackageChanges, savePackageChanges, suggestPackagePrice, undoLastPriceChange } from '../../server/admin/packages';
import { packagePriceToman, pinnedPricesFromRows } from '../../lib/package-price';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const SVC = '10000000-0000-0000-0000-000000000001';
const mockQuery = vi.mocked(query);
beforeEach(() => { vi.resetAllMocks(); vi.mocked(requireRequestUser).mockResolvedValue(ADMIN as never); });

const MONTHS = [1, 3, 6, 12];

describe('planPackageEdit — packages are independent', () => {
  const base = { unit: 2_490_000, pinned: {}, listed: MONTHS, per: 1 };

  it('lets the 3-month price be lower than 3 × the 1-month price without touching the others', () => {
    const p = planPackageEdit({ ...base, edits: [{ quantity: 3, priceToman: 6_900_000 }] });
    expect(p.target).toEqual({ unit: 2_490_000, packages: { '3': 6_900_000 } });
    expect(p.changes).toEqual([{ quantity: 3, from: 7_470_000, to: 6_900_000 }]);
    expect(p.pinnedBecauseBaseMoved).toEqual([]);
  });

  it('changing the 1-month price pins 3/6/12 at what customers pay now (no silent rewrite)', () => {
    const p = planPackageEdit({ ...base, edits: [{ quantity: 1, priceToman: 2_000_000 }] });
    expect(p.target.unit).toBe(2_000_000);
    expect(p.target.packages).toEqual({ '3': 7_470_000, '6': 14_940_000, '12': 29_880_000 });
    expect(p.changes).toEqual([{ quantity: 1, from: 2_490_000, to: 2_000_000 }]);
    expect(p.pinnedBecauseBaseMoved).toEqual([3, 6, 12]);
  });

  it('an explicit edit of 3 months together with the 1-month price wins over pinning', () => {
    const p = planPackageEdit({ ...base, edits: [{ quantity: 1, priceToman: 2_000_000 }, { quantity: 3, priceToman: 5_500_000 }] });
    expect(p.target.packages['3']).toBe(5_500_000);
    expect(p.target.packages['6']).toBe(14_940_000);
  });

  it('setting a package to exactly quantity × unit (or null) removes its pin', () => {
    const pinned = { '3': 6_900_000 };
    const a = planPackageEdit({ ...base, pinned, edits: [{ quantity: 3, priceToman: null }] });
    expect(a.target.packages).toEqual({});
    expect(a.changes).toEqual([{ quantity: 3, from: 6_900_000, to: 7_470_000 }]);
    const b = planPackageEdit({ ...base, pinned, edits: [{ quantity: 3, priceToman: 7_470_000 }] });
    expect(b.target.packages).toEqual({});
  });

  it('reports no change when nothing differs', () => {
    expect(planPackageEdit({ ...base, edits: [{ quantity: 6, priceToman: 14_940_000 }] }).changed).toBe(false);
  });

  it('keeps an exact odd pack price by pinning the base pack when it is not divisible (1,000 followers)', () => {
    const p = planPackageEdit({ unit: 180, pinned: {}, listed: [500, 1000, 2000], per: 1000, edits: [{ quantity: 1000, priceToman: 150_500 }] });
    expect(p.target.unit).toBe(151);
    expect(p.target.packages['1000']).toBe(150_500);
    expect(p.target.packages['500']).toBe(90_000);
    expect(p.target.packages['2000']).toBe(360_000);
  });
});

describe('helpers', () => {
  it('diffs two states over the listed quantities', () => {
    const d = diffStates({ unit: 10, packages: {} }, { unit: 10, packages: { '3': 25 } }, [1, 3]);
    expect(d.unit).toBeNull();
    expect(d.changes).toEqual([{ quantity: 3, from: 30, to: 25 }]);
  });
  it('computes margin from the unit cost', () => {
    expect(marginPct(1000, 1, 800)).toBe(20);
    expect(marginPct(1000, 1, null)).toBeNull();
    expect(marginPct(900, 3, 300)).toBe(0);
  });
  it('suggests a longer plan price from the base price with an optional discount, only as a number', () => {
    expect(suggestPackagePrice(2_490_000, 1, 3, 0)).toBe(7_470_000);
    expect(suggestPackagePrice(2_490_000, 1, 12, 15, 1000)).toBe(25_398_000);
  });
  it('package price rule: pinned wins, others are quantity × unit', () => {
    const pinned = pinnedPricesFromRows([{ quantity: '3', priceMinor: '6900000' }, { quantity: 'x', priceMinor: '1' }]);
    expect(pinned).toEqual({ 3: 6_900_000 });
    expect(packagePriceToman(3, 2_490_000, pinned)).toBe(6_900_000);
    expect(packagePriceToman(1, 2_490_000, pinned)).toBe(2_490_000);
    expect(packagePriceToman(6, 2_490_000)).toBe(14_940_000);
  });
});

function stateRows(unit = 2_490_000, pinned: Record<string, number> = {}) {
  return (async (sql: string) => {
    if (/SELECT slug FROM services/.test(sql)) return { rows: [{ slug: 'sub-claude-pro' }] };
    if (/FROM service_prices\s+WHERE service_id/.test(sql)) return { rows: [{ id: 'cur', unit_price_minor: String(unit), min_quantity: '1', max_quantity: null }] };
    if (/FROM service_package_prices\s+WHERE service_id/.test(sql)) return { rows: Object.entries(pinned).map(([quantity, p]) => ({ quantity, price_minor: String(p) })) };
    if (/INSERT INTO service_price_batches/.test(sql)) return { rows: [{ id: 'batch-1' }] };
    if (/RETURNING id, unit_price_minor/.test(sql)) return { rows: [{ id: 'old', unit_price_minor: String(unit), price_version: '2' }] };
    if (/INSERT INTO service_prices/.test(sql)) return { rows: [{ id: 'new-unit' }] };
    return { rows: [] };
  }) as never;
}
const sqls = () => mockQuery.mock.calls.map(c => String(c[0]));

describe('savePackageChanges', () => {
  it('pins only the edited package: one batch, closes nothing else, never updates an amount in place, audits', async () => {
    mockQuery.mockImplementation(stateRows());
    const r = await savePackageChanges({ actorUserId: ADMIN, serviceId: SVC, edits: [{ quantity: 3, priceToman: 6_900_000 }] });
    expect(r).toMatchObject({ changed: true, batchId: 'batch-1', changes: [{ quantity: 3, from: 7_470_000, to: 6_900_000 }] });
    const s = sqls();
    expect(s.filter(x => /INSERT INTO service_package_prices/.test(x))).toHaveLength(1);
    expect(s.some(x => /INSERT INTO service_prices/.test(x))).toBe(false);
    expect(s.some(x => /UPDATE service_package_prices SET price_minor/.test(x))).toBe(false);
    const ins = mockQuery.mock.calls.find(c => /INSERT INTO service_package_prices/.test(String(c[0])))!;
    expect(ins[1]).toEqual([SVC, '3', 6_900_000, ADMIN, 'batch-1']);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.package.save', entityId: SVC, metadata: expect.objectContaining({ batchId: 'batch-1' }) }), expect.anything());
  });

  it('moving the base price swaps the unit price as a new row and pins the others in the same transaction', async () => {
    mockQuery.mockImplementation(stateRows());
    await savePackageChanges({ actorUserId: ADMIN, serviceId: SVC, edits: [{ quantity: 1, priceToman: 2_000_000 }] });
    const s = sqls();
    expect(s.filter(x => /INSERT INTO service_prices/.test(x))).toHaveLength(1);
    expect(s.filter(x => /INSERT INTO service_package_prices/.test(x))).toHaveLength(3);
  });

  it('is a no-op (no batch, no audit) when nothing changes', async () => {
    mockQuery.mockImplementation(stateRows());
    const r = await savePackageChanges({ actorUserId: ADMIN, serviceId: SVC, edits: [{ quantity: 1, priceToman: 2_490_000 }] });
    expect(r.changed).toBe(false);
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it('replays an idempotency key without writing again', async () => {
    mockQuery.mockImplementation((async (sql: string) => {
      if (/SELECT slug FROM services/.test(sql)) return { rows: [{ slug: 'sub-claude-pro' }] };
      if (/idempotency_key=\$2/.test(sql)) return { rows: [{ id: 'batch-old' }] };
      return { rows: [] };
    }) as never);
    const r = await savePackageChanges({ actorUserId: ADMIN, serviceId: SVC, edits: [{ quantity: 3, priceToman: 5 }], idempotencyKey: 'key-12345678' });
    expect(r).toMatchObject({ replayed: true, batchId: 'batch-old', changed: false });
    expect(sqls().some(x => /INSERT/.test(x))).toBe(false);
  });

  it.each([
    [[{ quantity: 4, priceToman: 100 }], 'not a listed package'],
    [[{ quantity: 3, priceToman: 0 }], 'zero price'],
    [[{ quantity: 3, priceToman: 1.5 }], 'fraction'],
    [[{ quantity: 3, priceToman: 3_000_000_000 }], 'too large'],
    [[{ quantity: 3, priceToman: 5 }, { quantity: 3, priceToman: 6 }], 'duplicate'],
    [[], 'empty'],
  ])('rejects %j (%s)', async (edits) => {
    mockQuery.mockImplementation(stateRows());
    await expect(savePackageChanges({ actorUserId: ADMIN, serviceId: SVC, edits })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(sqls().some(x => /INSERT/.test(x))).toBe(false);
  });

  it('refuses non-admins before reading', async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new AppError('FORBIDDEN', 'x'));
    await expect(savePackageChanges({ actorUserId: ADMIN, serviceId: SVC, edits: [{ quantity: 3, priceToman: 5 }] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('previews without writing', async () => {
    mockQuery.mockImplementation(stateRows());
    const p = await previewPackageChanges({ actorUserId: ADMIN, serviceId: SVC, edits: [{ quantity: 1, priceToman: 2_000_000 }] });
    expect(p.pinnedBecauseBaseMoved).toEqual([3, 6, 12]);
    expect(sqls().some(x => /INSERT|UPDATE/.test(x))).toBe(false);
  });
});

describe('undoLastPriceChange', () => {
  it('restores the before-state of the latest batch as a new UNDO batch and marks the old one undone', async () => {
    const before = { unit: 2_490_000, packages: {} };
    mockQuery.mockImplementation((async (sql: string) => {
      if (/SELECT slug FROM services/.test(sql)) return { rows: [{ slug: 'sub-claude-pro' }] };
      if (/FROM service_price_batches\s+WHERE service_id=\$1 AND kind <> 'UNDO'/.test(sql)) return { rows: [{ id: 'b1', kind: 'EDIT', before_state: before, after_state: { unit: 2_490_000, packages: { '3': 6_900_000 } }, undone_at: null, group_id: null }] };
      if (/FROM service_prices\s+WHERE service_id/.test(sql)) return { rows: [{ id: 'cur', unit_price_minor: '2490000', min_quantity: '1', max_quantity: null }] };
      if (/FROM service_package_prices\s+WHERE service_id/.test(sql)) return { rows: [{ quantity: '3', price_minor: '6900000' }] };
      if (/INSERT INTO service_price_batches/.test(sql)) return { rows: [{ id: 'b2' }] };
      return { rows: [] };
    }) as never);
    expect(await undoLastPriceChange({ actorUserId: ADMIN, serviceId: SVC })).toEqual({ batchId: 'b1', restored: true });
    expect(sqls().some(x => /UPDATE service_package_prices SET active=false/.test(x))).toBe(true);
    expect(sqls().some(x => /UPDATE service_price_batches SET undone_at=now\(\)/.test(x))).toBe(true);
    expect(sqls().some(x => /INSERT INTO service_package_prices/.test(x))).toBe(false);
    const b = mockQuery.mock.calls.find(c => /INSERT INTO service_price_batches/.test(String(c[0])))!;
    expect(b[1]![1]).toBe('UNDO');
  });
  it('says so when there is nothing to undo', async () => {
    mockQuery.mockImplementation((async (sql: string) => (/SELECT slug FROM services/.test(sql) ? { rows: [{ slug: 'x' }] } : { rows: [] })) as never);
    await expect(undoLastPriceChange({ actorUserId: ADMIN, serviceId: SVC })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('package routes', () => {
  type R = typeof import('../../app/api/v1/admin/catalog/services/[id]/packages/route');
  let POST: R['POST'];
  beforeAll(async () => { POST = (await import('../../app/api/v1/admin/catalog/services/[id]/packages/route')).POST; }, 60000);
  const req = (body: unknown) => ({ headers: { get: () => null }, url: 'http://localhost:3000/x', method: 'POST', json: async () => body }) as never;
  const ctx = (id = SVC) => ({ params: Promise.resolve({ id }) });
  it('guards origin, admin role, ids and mode before any write', async () => {
    vi.mocked(assertSameOrigin).mockImplementationOnce(() => { throw new AppError('FORBIDDEN', 'cross'); });
    expect((await POST(req({ mode: 'save' }), ctx())).status).toBe(403);
    vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new AppError('FORBIDDEN', 'x'));
    expect((await POST(req({ mode: 'save' }), ctx())).status).toBe(403);
    expect((await POST(req({ mode: 'save' }), ctx('bad'))).status).toBe(400);
    expect((await POST(req({ mode: 'drop' }), ctx())).status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
