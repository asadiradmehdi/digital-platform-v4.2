/**
 * Unit tests for server/commerce/orders.ts
 * createOrder, listOrders, transitionOrder
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { createOrder, listOrders, transitionOrder } from '../../server/commerce/orders';

const mockTx = vi.mocked(withWorkspaceTransaction);
beforeEach(() => vi.clearAllMocks());

// Idempotency requires ≥ 16 chars
const IDEM = 'idem-key-abcdef01';

// ─── createOrder ──────────────────────────────────────────────────────────────

describe('createOrder', () => {
  const baseInput = {
    workspaceId: 'ws-1',
    serviceId: 'svc-1',
    quantity: 2n,
    parameters: { target: 'https://example.com' },
    idempotencyKey: IDEM,
  };

  it('returns existing order when idempotency key matches', async () => {
    const existing = { id: 'ord-existing', status: 'PAYMENT_PENDING' };
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows: [existing] });
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    const result = await createOrder(baseInput);
    expect(result).toEqual(existing);
    // Short-circuit: only the idempotency check query should run
    expect(clientQuery).toHaveBeenCalledTimes(1);
  });

  it('throws CONFLICT when no active catalog price exists', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })   // idempotency check — no existing
      .mockResolvedValueOnce({ rows: [] });  // catalog price — none found

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await expect(createOrder(baseInput)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('creates an order and order_items on the happy path', async () => {
    const priceRow = {
      id: 'price-1',
      unit_price_minor: '1000',
      currency: 'IRT',
      price_version: 1,
      pricing_rule_id: null,
      fx_rate_id: null,
      provider_cost_minor: null,
      provider_cost_currency: null,
    };
    const newOrder = { id: 'ord-new', status: 'PAYMENT_PENDING' };

    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })            // idempotency check
      .mockResolvedValueOnce({ rows: [priceRow] })    // catalog price
      .mockResolvedValueOnce({ rows: [newOrder] })    // INSERT orders
      .mockResolvedValueOnce({ rows: [] })            // INSERT order_items
      .mockResolvedValueOnce({ rows: [] })            // INSERT order_events
      .mockResolvedValueOnce({ rows: [] });           // INSERT outbox_events

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    const result = await createOrder(baseInput);
    expect(result).toEqual(newOrder);
    // 6 domain writes + the audit row, which now commits on the same tenant tx client.
    expect(clientQuery).toHaveBeenCalledTimes(7);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO audit_logs"))).toBe(true);
  });

  it('calculates total as quantity * unit_price_minor', async () => {
    const priceRow = {
      id: 'price-1', unit_price_minor: '500', currency: 'IRT', price_version: 1,
      pricing_rule_id: null, fx_rate_id: null, provider_cost_minor: null, provider_cost_currency: null,
    };
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [priceRow] })
      .mockResolvedValueOnce({ rows: [{ id: 'ord-calc', status: 'PAYMENT_PENDING' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await createOrder({ ...baseInput, quantity: 3n });
    // 3rd call (index 2) = INSERT INTO orders
    const params = clientQuery.mock.calls[2][1] as unknown[];
    // total = 3 * 500 = 1500; it's passed as params[2] (subtotal_minor and total_minor are same param $3)
    expect(String(params[2])).toBe('1500');
  });

  it('throws VALIDATION_ERROR when idempotencyKey is too short', async () => {
    await expect(
      createOrder({ ...baseInput, idempotencyKey: 'short' })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockTx).not.toHaveBeenCalled();
  });

  it('throws FORBIDDEN when riskState is RESTRICTED', async () => {
    await expect(
      createOrder({ ...baseInput, riskState: 'RESTRICTED' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockTx).not.toHaveBeenCalled();
  });

  it('inserts an outbox event for order.payment_pending', async () => {
    const priceRow = {
      id: 'price-1', unit_price_minor: '100', currency: 'IRT', price_version: 1,
      pricing_rule_id: null, fx_rate_id: null, provider_cost_minor: null, provider_cost_currency: null,
    };
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [priceRow] })
      .mockResolvedValueOnce({ rows: [{ id: 'ord-1', status: 'PAYMENT_PENDING' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await createOrder(baseInput);
    const outboxCall = clientQuery.mock.calls[5];
    expect(outboxCall[0]).toContain('outbox_events');
    expect(outboxCall[0]).toContain('order.payment_pending');
  });
});

// ─── listOrders ───────────────────────────────────────────────────────────────

describe('listOrders', () => {
  it('returns items and null nextCursor when no more pages', async () => {
    const rows = [
      { id: 'ord-1', status: 'PAID', currency: 'IRT', totalMinor: '1000', createdAt: '2026-01-01' },
      { id: 'ord-2', status: 'PENDING', currency: 'IRT', totalMinor: '500', createdAt: '2026-01-02' },
    ];
    // listOrders uses withWorkspaceTransaction → client.query → returns r, then r.rows
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows });
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => {
      // fn receives client; client.query returns the result directly
      return fn({ query: clientQuery } as never);
    });

    const result = await listOrders('ws-1', 10);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('returns nextCursor when more pages exist (limit+1 returned)', async () => {
    // 11 rows returned when limit=10 → has next page
    const rows = Array.from({ length: 11 }, (_, i) => ({
      id: `ord-${i}`,
      status: 'PAID',
      currency: 'IRT',
      totalMinor: '100',
      createdAt: '2026-01-01',
    }));
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows });
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    const result = await listOrders('ws-1', 10);
    expect(result.items).toHaveLength(10);
    expect(result.nextCursor).toBe('ord-9');
  });

  it('passes cursor to query when provided', async () => {
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows: [] });
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await listOrders('ws-1', 5, 'cursor-uuid');
    const params = clientQuery.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe('cursor-uuid');
  });

  it('passes null cursor when not provided', async () => {
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows: [] });
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await listOrders('ws-1', 5);
    const params = clientQuery.mock.calls[0][1] as unknown[];
    expect(params[1]).toBeNull();
  });
});

// ─── transitionOrder ─────────────────────────────────────────────────────────

describe('transitionOrder', () => {
  it('transitions order to valid next status (PAYMENT_PENDING → PAID)', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ status: 'PAYMENT_PENDING' }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] })                               // UPDATE
      .mockResolvedValueOnce({ rows: [] });                              // INSERT order_events

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    const result = await transitionOrder('ord-1', 'ws-1', 'PAID');
    expect(result.from).toBe('PAYMENT_PENDING');
    expect(result.to).toBe('PAID');
  });

  it('throws NOT_FOUND when order does not exist', async () => {
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows: [] }); // no order found
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await expect(transitionOrder('ord-missing', 'ws-1', 'PAID')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws CONFLICT when transition is invalid (CANCELLED → PAID)', async () => {
    // CANCELLED has no valid transitions
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows: [{ status: 'CANCELLED' }] });
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await expect(transitionOrder('ord-1', 'ws-1', 'PAID')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('uses FOR UPDATE on SELECT to prevent concurrent transitions', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ status: 'PAYMENT_PENDING' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await transitionOrder('ord-1', 'ws-1', 'PAID');
    const selectSql = clientQuery.mock.calls[0][0] as string;
    expect(selectSql).toContain('FOR UPDATE');
  });

  it('inserts an order_events row on transition', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ status: 'PAYMENT_PENDING' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await transitionOrder('ord-1', 'ws-1', 'PAID');
    const eventSql = clientQuery.mock.calls[2][0] as string;
    expect(eventSql).toContain('order_events');
  });
});
