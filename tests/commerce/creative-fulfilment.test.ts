/**
 * Team (manual) fulfilment for design, automation and AI content orders:
 * quantity bounds at order creation, the paid → «در حال انجام توسط تیم» state, and operator completion.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withWorkspaceTransaction: vi.fn(), withTenantTransaction: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/queue/outbox-dispatch', () => ({ claimOutboxBatch: vi.fn(), markOutboxPublished: vi.fn(), markOutboxFailed: vi.fn() }));
vi.mock('../../server/providers/dispatch', () => ({ dispatchOrder: vi.fn() }));
vi.mock('../../server/core/config', () => ({ env: vi.fn(() => 'cron-secret') }));

import { withTenantTransaction, withWorkspaceTransaction } from '../../server/core/db';
import { writeAudit } from '../../server/core/audit';
import { claimOutboxBatch, markOutboxFailed, markOutboxPublished } from '../../server/queue/outbox-dispatch';
import { dispatchOrder } from '../../server/providers/dispatch';
import { createOrder } from '../../server/commerce/orders';
import { completeManualOrder } from '../../server/commerce/fulfilment';
import { canTransitionOrder } from '../../server/core/order-state';
import { orderStage } from '../../lib/order-progress';
import { isTeamFulfilled } from '../../lib/catalog-ui';

const mockWs = vi.mocked(withWorkspaceTransaction);
const mockTenant = vi.mocked(withTenantTransaction);
const q = vi.fn();

type OutboxModule = typeof import('../../app/api/internal/queue/outbox/route');
let OUTBOX: OutboxModule['POST'];
beforeAll(async () => { ({ POST: OUTBOX } = await import('../../app/api/internal/queue/outbox/route')); }, 60000);

beforeEach(() => {
  vi.resetAllMocks();
  const run = (async (_w: string, _u: string | undefined, fn: (c: { query: typeof q }) => unknown) => fn({ query: q })) as never;
  mockWs.mockImplementation(run);
  mockTenant.mockImplementation(run);
});

const price = (min: string | null, max: string | null) => ({ id: 'p', unit_price_minor: '390000', currency: 'IRT', price_version: 1, pricing_rule_id: null, fx_rate_id: null, provider_cost_minor: null, provider_cost_currency: null, min_quantity: min, max_quantity: max });
const input = (quantity: bigint) => ({ workspaceId: 'ws-1', serviceId: 'svc-1', quantity, parameters: { brief: 'پست معرفی محصول' }, idempotencyKey: 'idem-key-abcdef01' });

describe('createOrder quantity bounds', () => {
  it('rejects a quantity above the price row maximum (e.g. 2 logos when only 1 is sold)', async () => {
    q.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [price('1', '1')] });
    await expect(createOrder(input(2n))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(q).toHaveBeenCalledTimes(2); // nothing inserted
  });

  it('rejects a quantity below the minimum (e.g. 1 highlight cover when the minimum is 3)', async () => {
    q.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [price('3', '15')] });
    await expect(createOrder(input(1n))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('charges quantity × unit price inside the bounds', async () => {
    q.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [price('1', '10')] }).mockResolvedValueOnce({ rows: [] }) // no pinned package price
      .mockResolvedValueOnce({ rows: [{ id: 'ord-1', status: 'PAYMENT_PENDING' }] }).mockResolvedValue({ rows: [] });
    await createOrder(input(3n));
    expect(q.mock.calls[3][1]).toEqual(['ws-1', 'IRT', '1170000', 'idem-key-abcdef01']);
  });
});

function cron() {
  return { headers: { get: (k: string) => (k === 'authorization' ? 'Bearer cron-secret' : null) }, method: 'POST' } as unknown as Request;
}

describe('order.paid for a team-fulfilled service', () => {
  it('queues the order for the team and never calls a provider (no failed outbox row)', async () => {
    vi.mocked(claimOutboxBatch).mockResolvedValueOnce({ rows: [{ id: 'evt-1', aggregate_type: 'order', aggregate_id: 'ord-1', event_type: 'order.paid', payload: { orderId: 'ord-1', workspaceId: 'ws-1' } }] } as never);
    q.mockResolvedValueOnce({ rows: [{ service_id: 'svc-1', status: 'PAID', fulfillment_mode: 'MANUAL' }] }) // order lookup
      .mockResolvedValueOnce({ rows: [{ status: 'PAID' }] }) // transitionOrder: lock
      .mockResolvedValue({ rows: [] });
    const res = await OUTBOX(cron());
    expect(res.status).toBe(200);
    expect(q.mock.calls[0][0]).toContain('fulfillment_mode');
    expect(q.mock.calls.some(c => String(c[0]).startsWith('UPDATE orders SET status=') && c[1][1] === 'QUEUED')).toBe(true);
    expect(dispatchOrder).not.toHaveBeenCalled();
    expect(markOutboxPublished).toHaveBeenCalledWith('evt-1');
    expect(markOutboxFailed).not.toHaveBeenCalled();
  });

  it('still dispatches provider-fulfilled services', async () => {
    vi.mocked(claimOutboxBatch).mockResolvedValueOnce({ rows: [{ id: 'evt-2', aggregate_type: 'order', aggregate_id: 'ord-2', event_type: 'order.paid', payload: { orderId: 'ord-2', workspaceId: 'ws-1' } }] } as never);
    q.mockResolvedValueOnce({ rows: [{ service_id: 'svc-2', status: 'QUEUED', fulfillment_mode: 'PROVIDER' }] });
    await OUTBOX(cron());
    expect(dispatchOrder).toHaveBeenCalledWith({ workspaceId: 'ws-1', orderId: 'ord-2', serviceId: 'svc-2' });
  });

  it('shows the customer an honest team stage on web and mobile', () => {
    expect(isTeamFulfilled('design') && isTeamFulfilled('automation') && isTeamFulfilled('ai')).toBe(true);
    expect(isTeamFulfilled('instagram')).toBe(false);
    expect(orderStage('QUEUED', true)).toEqual({ label: 'در حال انجام توسط تیم', steps: 2, tone: 'live' });
    expect(orderStage('COMPLETED', true).label).toBe('تحویل شد');
    expect(orderStage('QUEUED').label).toBe('در صف انجام');
    expect(orderStage('REFUNDED', true).tone).toBe('bad');
  });
});

describe('completeManualOrder', () => {
  const args = { orderId: 'ord-1', workspaceId: 'ws-1', actorUserId: 'admin-1' };

  it('moves a queued team order to COMPLETED through IN_PROGRESS, with events and an audit record', async () => {
    q.mockResolvedValueOnce({ rows: [{ status: 'QUEUED', fulfillment_mode: 'MANUAL' }] }).mockResolvedValue({ rows: [] });
    await expect(completeManualOrder(args)).resolves.toEqual({ id: 'ord-1', status: 'COMPLETED', changed: true });
    const statuses = q.mock.calls.filter(c => String(c[0]).startsWith('UPDATE orders')).map(c => c[1][1]);
    expect(statuses).toEqual(['IN_PROGRESS', 'COMPLETED']);
    expect(mockWs).toHaveBeenCalledWith('ws-1', 'admin-1', expect.any(Function));
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'order.fulfilled_manually', entityId: 'ord-1' }), expect.anything());
    expect(canTransitionOrder('QUEUED', 'IN_PROGRESS')).toBe(true);
  });

  it('is idempotent for an already completed order', async () => {
    q.mockResolvedValueOnce({ rows: [{ status: 'COMPLETED', fulfillment_mode: 'MANUAL' }] });
    await expect(completeManualOrder(args)).resolves.toMatchObject({ changed: false });
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it('refuses provider orders, cancelled orders and unknown orders', async () => {
    q.mockResolvedValueOnce({ rows: [{ status: 'QUEUED', fulfillment_mode: 'PROVIDER' }] });
    await expect(completeManualOrder(args)).rejects.toMatchObject({ code: 'CONFLICT' });
    q.mockResolvedValueOnce({ rows: [{ status: 'CANCELLED', fulfillment_mode: 'MANUAL' }] });
    await expect(completeManualOrder(args)).rejects.toMatchObject({ code: 'CONFLICT' });
    q.mockResolvedValueOnce({ rows: [] });
    await expect(completeManualOrder(args)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
