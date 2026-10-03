import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(async (_wid: string, _opts: unknown, fn: Function) => fn({ query: vi.fn() })),
}));
vi.mock('../../server/core/idempotency', () => ({
  requireIdempotencyKey: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { createCheckout } from '../../server/commerce/checkout';

const mockTx = vi.mocked(withWorkspaceTransaction);

beforeEach(() => vi.clearAllMocks());

function makeClientQuery(...responses: Array<{ rows: unknown[] }>) {
  const mock = vi.fn();
  for (const r of responses) mock.mockResolvedValueOnce(r);
  mock.mockResolvedValue({ rows: [] });
  return mock;
}

describe('createCheckout', () => {
  it('returns existing session when idempotency key matches (idempotency)', async () => {
    const existing = { id: 'cs-1', status: 'OPEN', total_minor: '10000', currency: 'IRT', quote_hash: 'abc' };
    const clientQuery = makeClientQuery({ rows: [existing] });
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    const result = await createCheckout({
      workspaceId: 'ws-1',
      items: [{ serviceId: 'svc-1', quantity: 1n }],
      idempotencyKey: 'idem-1',
    });

    expect(result).toEqual(existing);
  });

  it('throws VALIDATION_ERROR when items array is empty', async () => {
    await expect(
      createCheckout({ workspaceId: 'ws-1', items: [], idempotencyKey: 'idem-2' })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws VALIDATION_ERROR when item has both serviceId and planId', async () => {
    const clientQuery = makeClientQuery({ rows: [] }); // no existing session
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    await expect(
      createCheckout({
        workspaceId: 'ws-1',
        items: [{ serviceId: 'svc-1', planId: 'plan-1', quantity: 1n }],
        idempotencyKey: 'idem-3',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws NOT_FOUND when service price is not active', async () => {
    const clientQuery = makeClientQuery(
      { rows: [] },    // no existing session
      { rows: [] },    // service price lookup -> not found
    );
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    await expect(
      createCheckout({
        workspaceId: 'ws-1',
        items: [{ serviceId: 'svc-missing', quantity: 1n }],
        idempotencyKey: 'idem-4',
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('creates a checkout session and returns it for a valid service item', async () => {
    const sessionResult = { id: 'cs-5', status: 'OPEN', total_minor: '5000', currency: 'IRT', quote_hash: 'deadbeef' };
    const clientQuery = makeClientQuery(
      { rows: [] },    // no existing session
      { rows: [{ price_id: 'price-1', service_id: 'svc-1', unit_price_minor: '5000', currency: 'IRT', price_version: 1, pricing_rule_id: null, fx_rate_id: null, provider_cost_minor: null, provider_cost_currency: null }] },
      { rows: [sessionResult] },   // INSERT session
      { rows: [] },   // INSERT item
    );
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    const result = await createCheckout({
      workspaceId: 'ws-1',
      items: [{ serviceId: 'svc-1', quantity: 1n }],
      idempotencyKey: 'idem-5',
    });

    expect(result).toMatchObject({ id: 'cs-5', status: 'OPEN' });
  });

  it('throws CONFLICT when coupon is not active', async () => {
    const expiredCoupon = {
      active: false,
      discount_type: 'PERCENT',
      discount_value: '10',
      max_discount_minor: null,
      minimum_subtotal_minor: '0',
      max_redemptions: null,
      redeemed_count: '0',
      per_workspace_limit: '100',
      starts_at: null,
      expires_at: null,
    };
    const clientQuery = makeClientQuery(
      { rows: [] },  // no existing session
      { rows: [{ price_id: 'price-1', service_id: 'svc-1', unit_price_minor: '5000', currency: 'IRT', price_version: 1, pricing_rule_id: null, fx_rate_id: null, provider_cost_minor: null, provider_cost_currency: null }] },
      { rows: [expiredCoupon] },  // coupon lookup
    );
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    await expect(
      createCheckout({
        workspaceId: 'ws-1',
        items: [{ serviceId: 'svc-1', quantity: 1n }],
        couponCode: 'EXPIRED10',
        idempotencyKey: 'idem-6',
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
