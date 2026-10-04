import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

vi.mock('../../server/commerce/orders', () => ({
  transitionOrder: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { transitionOrder } from '../../server/commerce/orders';
import { submitQueuedOrder } from '../../server/queue/order-worker';

const mockWithWorkspaceTransaction = vi.mocked(withWorkspaceTransaction);
const mockTransitionOrder = vi.mocked(transitionOrder);

beforeEach(() => vi.clearAllMocks());

function buildMockClient(overrides: Record<string, unknown> = {}) {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM orders o JOIN order_items')) {
        return { rows: [{ id: 'order-1', status: 'QUEUED', quantity: '5', parameters: {} }], rowCount: 1 };
      }
      if (sql.includes('FROM external_orders')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [{ id: 'attempt-1' }], rowCount: 1 };
    }),
    ...overrides,
  };
}

describe('submitQueuedOrder', () => {
  const baseInput = {
    workspaceId: 'ws-1',
    orderId: 'order-1',
    providerId: 'provider-1',
    providerServiceId: 'svc-1',
    externalServiceId: 'ext-svc-1',
    adapter: {
      submit: vi.fn(),
      verify: vi.fn(),
    } as never,
  };

  it('skips when order is in a non-submittable status', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM orders')) return { rows: [{ id: 'order-1', status: 'PAID', quantity: '1', parameters: {} }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
    };
    mockWithWorkspaceTransaction.mockImplementationOnce(async (_wsId, _userId, fn) => fn(client as never));
    const result = await submitQueuedOrder(baseInput);
    expect(result).toMatchObject({ skipped: true, reason: 'PAID' });
  });

  it('skips when external order already exists for this provider', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM orders')) return { rows: [{ id: 'order-1', status: 'QUEUED', quantity: '5', parameters: {} }], rowCount: 1 };
        if (sql.includes('FROM external_orders')) return { rows: [{ external_order_id: 'ext-123' }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
    };
    mockWithWorkspaceTransaction.mockImplementationOnce(async (_wsId, _userId, fn) => fn(client as never));
    const result = await submitQueuedOrder(baseInput);
    expect(result).toMatchObject({ skipped: true, externalOrderId: 'ext-123' });
  });

  it('throws NOT_FOUND when order row is missing', async () => {
    const client = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    };
    // First call: the main transaction (will throw NOT_FOUND)
    mockWithWorkspaceTransaction.mockImplementationOnce(async (_wsId, _userId, fn) => fn(client as never));
    // Second call: the error catch handler tries to update order_attempts — return a resolved promise
    mockWithWorkspaceTransaction.mockResolvedValueOnce(undefined as never);
    await expect(submitQueuedOrder(baseInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('inserts order_attempt with ON CONFLICT DO NOTHING (idempotency)', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('FROM orders')) return { rows: [{ id: 'order-1', status: 'QUEUED', quantity: '5', parameters: {} }], rowCount: 1 };
        if (sql.includes('FROM external_orders')) return { rows: [], rowCount: 0 };
        return { rows: [{ id: 'x' }], rowCount: 1 };
      }),
    };
    const adapterSubmit = vi.fn().mockResolvedValue({ externalOrderId: 'ext-new', status: 'PENDING', raw: {} });
    mockWithWorkspaceTransaction
      .mockImplementationOnce(async (_wsId, _userId, fn) => fn(client as never))
      .mockImplementation(async (_wsId, _userId, fn) => {
        return fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as never);
      });
    mockTransitionOrder.mockResolvedValue(undefined as never);

    const input = { ...baseInput, adapter: { submit: adapterSubmit, verify: vi.fn() } as never };
    await submitQueuedOrder(input);

    const attemptSql = queries.find(q => q.includes('INSERT INTO order_attempts'));
    expect(attemptSql).toBeDefined();
    expect(attemptSql).toContain('ON CONFLICT(order_id,idempotency_key) DO NOTHING');
  });

  it('calls adapter.submit with correct externalServiceId and quantity', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM orders')) return { rows: [{ id: 'order-1', status: 'QUEUED', quantity: '7', parameters: { target: '@user' } }], rowCount: 1 };
        if (sql.includes('FROM external_orders')) return { rows: [], rowCount: 0 };
        return { rows: [{ id: 'x' }], rowCount: 1 };
      }),
    };
    const adapterSubmit = vi.fn().mockResolvedValue({ externalOrderId: 'ext-xyz', status: 'ACTIVE', raw: {} });
    mockWithWorkspaceTransaction
      .mockImplementationOnce(async (_wsId, _userId, fn) => fn(client as never))
      .mockImplementation(async (_wsId, _userId, fn) => fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as never));
    mockTransitionOrder.mockResolvedValue(undefined as never);

    const input = { ...baseInput, adapter: { submit: adapterSubmit, verify: vi.fn() } as never };
    await submitQueuedOrder(input);

    expect(adapterSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ externalServiceId: 'ext-svc-1', quantity: 7n }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining('order-1') }),
    );
  });

  it('calls transitionOrder with PROVIDER_SUBMITTED after successful submit', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM orders')) return { rows: [{ id: 'order-1', status: 'QUEUED', quantity: '5', parameters: {} }], rowCount: 1 };
        if (sql.includes('FROM external_orders')) return { rows: [], rowCount: 0 };
        return { rows: [{ id: 'x' }], rowCount: 1 };
      }),
    };
    const adapterSubmit = vi.fn().mockResolvedValue({ externalOrderId: 'ext-final', status: 'ACTIVE', raw: {} });
    mockWithWorkspaceTransaction
      .mockImplementationOnce(async (_wsId, _userId, fn) => fn(client as never))
      .mockImplementation(async (_wsId, _userId, fn) => fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as never));
    mockTransitionOrder.mockResolvedValue(undefined as never);

    const input = { ...baseInput, adapter: { submit: adapterSubmit, verify: vi.fn() } as never };
    await submitQueuedOrder(input);

    expect(mockTransitionOrder).toHaveBeenCalledWith('order-1', 'ws-1', 'PROVIDER_SUBMITTED');
  });
});
