import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/commerce/fulfilment', () => ({ completeManualOrder: vi.fn() }));
vi.mock('../../server/payments/refund', () => ({ refundOrder: vi.fn() }));
vi.mock('../../server/notifications/inbox', () => ({ notifyUser: vi.fn() }));
vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withTenantTransaction: vi.fn(async (_w: string, _u: string, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});
import { writeAudit } from '../../server/core/audit';
import { query } from '../../server/core/db';
import { completeManualOrder } from '../../server/commerce/fulfilment';
import { refundOrder } from '../../server/payments/refund';
import { notifyUser } from '../../server/notifications/inbox';
import { addOrderNote, changeOrderStatus, cleanProofUrl, deliverOrder, orderCode, refundOrCancel, searchOrders } from '../../server/admin/orders';

const A = '11111111-1111-4111-8111-111111111111';
const O = '20000000-0000-4000-8000-000000000002';
const W = '30000000-0000-4000-8000-000000000003';
const U = '40000000-0000-4000-8000-000000000004';
const q = vi.mocked(query);
beforeEach(() => {
  vi.resetAllMocks();
  q.mockImplementation((async (sql: string) => /system_admin_order_workspace/.test(sql) ? { rows: [{ workspace_id: W, owner_user_id: U }] } : { rows: [] }) as never);
});

describe('orders desk', () => {
  it('order code is stable and short', () => expect(orderCode(O)).toBe('ZP-20000000'));

  it('proof links must be https without credentials', () => {
    expect(cleanProofUrl('https://example.com/p.png')).toBe('https://example.com/p.png');
    expect(cleanProofUrl('')).toBeNull();
    for (const bad of ['http://x.com', 'javascript:alert(1)', 'data:text/html,hi', 'https://a:b@x.com', 'not a url']) expect(() => cleanProofUrl(bad)).toThrow();
  });

  it('search normalises filters and passes them to the routing function', async () => {
    await searchOrders(A, { status: 'BOGUS', search: '  علی ', category: 'x y', attention: true, page: 2 });
    const args = q.mock.calls[0][1] as unknown[];
    expect(args[0]).toBeNull(); expect(args[1]).toBe('علی'); expect(args[2]).toBeNull(); expect(args[6]).toBe(true); expect(args[9]).toBe(25);
  });

  it('refuses manual moves into money states and COMPLETED', async () => {
    for (const to of ['CANCELLED', 'REFUNDED', 'REFUND_PENDING', 'COMPLETED', 'PAID']) await expect(changeOrderStatus({ actorUserId: A, orderId: O, to })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('applies an allowed transition, records an event and audits it', async () => {
    q.mockImplementation((async (sql: string) => /system_admin_order_workspace/.test(sql) ? { rows: [{ workspace_id: W, owner_user_id: U }] } : /SELECT status/.test(sql) ? { rows: [{ status: 'QUEUED' }] } : { rows: [] }) as never);
    const r = await changeOrderStatus({ actorUserId: A, orderId: O, to: 'IN_PROGRESS', note: 'شروع شد' });
    expect(r).toEqual({ id: O, status: 'IN_PROGRESS', changed: true });
    expect(q.mock.calls.some(c => /INSERT INTO order_events/.test(String(c[0])))).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.order.status', workspaceId: W }), expect.anything());
  });

  it('rejects a transition the state machine forbids', async () => {
    q.mockImplementation((async (sql: string) => /system_admin_order_workspace/.test(sql) ? { rows: [{ workspace_id: W, owner_user_id: U }] } : /SELECT status/.test(sql) ? { rows: [{ status: 'COMPLETED' }] } : { rows: [] }) as never);
    await expect(changeOrderStatus({ actorUserId: A, orderId: O, to: 'QUEUED' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('unknown order is NOT_FOUND', async () => {
    q.mockResolvedValue({ rows: [] } as never);
    await expect(addOrderNote({ actorUserId: A, orderId: O, body: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('delivery passes note+proof to the fulfilment service and tells the customer', async () => {
    vi.mocked(completeManualOrder).mockResolvedValue({ id: O, status: 'COMPLETED', changed: true });
    await deliverOrder({ actorUserId: A, orderId: O, note: 'انجام شد', proofUrl: 'https://example.com/x' });
    expect(completeManualOrder).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: W, proofUrl: 'https://example.com/x', note: 'انجام شد' }));
    expect(notifyUser).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: W, userId: U, category: 'orders' }));
  });

  it('a repeated delivery does not notify again', async () => {
    vi.mocked(completeManualOrder).mockResolvedValue({ id: O, status: 'COMPLETED', changed: false });
    await deliverOrder({ actorUserId: A, orderId: O, note: 'x' });
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it('refund needs an idempotency key and a real reason, then uses the payments service', async () => {
    await expect(refundOrCancel({ actorUserId: A, orderId: O, mode: 'REFUND', reason: 'مشتری درخواست داد', idempotencyKey: null })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(refundOrCancel({ actorUserId: A, orderId: O, mode: 'REFUND', reason: 'x', idempotencyKey: 'key-12345' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(refundOrder).not.toHaveBeenCalled();
    vi.mocked(refundOrder).mockResolvedValue({ orderId: O, orderStatus: 'REFUND_PENDING', refund: { id: 'r1', status: 'PAID', amountMinor: '1', currency: 'IRR', destination: 'WALLET' } } as never);
    await refundOrCancel({ actorUserId: A, orderId: O, mode: 'REFUND', reason: 'مشتری درخواست داد', idempotencyKey: 'key-12345' });
    expect(refundOrder).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: W, mode: 'REFUND', idempotencyKey: 'key-12345', actorUserId: A }));
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.order.refund' }), expect.anything());
  });

  it('cancel cannot carry a partial amount', async () => {
    await expect(refundOrCancel({ actorUserId: A, orderId: O, mode: 'CANCEL', amountToman: 5, reason: 'لغو توسط مشتری', idempotencyKey: 'key-12345' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
