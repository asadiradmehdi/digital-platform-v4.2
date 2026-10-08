import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/support/workspace', () => ({ resolveSupportWorkspace: vi.fn() }));
vi.mock('../../server/support/tickets', () => ({ listTickets: vi.fn(), getTicket: vi.fn() }));
vi.mock('../../server/content/trust', () => ({ getSupportContact: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { resolveSupportWorkspace } from '../../server/support/workspace';
import { getTicket, listTickets } from '../../server/support/tickets';
import { getSupportContact } from '../../server/content/trust';
import { AppError } from '../../server/core/errors';

const WS = '11111111-1111-4111-8111-111111111111';
const T = '22222222-2222-4222-8222-222222222222';
const summary = {
  id: T, code: 'ZT-10001', subject: 'سفارش', status: 'ANSWERED', category: 'ORDER', orderId: '33333333-3333-4333-8333-333333333333',
  createdAt: '2026-10-08T08:00:00Z', lastMessageAt: '2026-10-08T09:00:00Z', unread: true, preview: 'بررسی شد', lastAuthor: 'STAFF',
} as const;

let LIST: typeof import('../../app/api/v1/app/support/route').GET;
let ONE: typeof import('../../app/api/v1/app/support/[id]/route').GET;
beforeAll(async () => {
  ({ GET: LIST } = await import('../../app/api/v1/app/support/route'));
  ({ GET: ONE } = await import('../../app/api/v1/app/support/[id]/route'));
}, 60000);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestUser).mockResolvedValue('u1' as never);
  vi.mocked(resolveSupportWorkspace).mockResolvedValue(WS);
  vi.mocked(getSupportContact).mockResolvedValue({ phones: [], hours: 'شنبه تا پنج‌شنبه' });
});

const req = () => ({ headers: { get: () => null }, nextUrl: new URL('http://x/api/v1/app/support') }) as never;

describe('GET /api/v1/app/support', () => {
  it('returns contact, categories and server-formatted ticket cards', async () => {
    vi.mocked(listTickets).mockResolvedValue([summary as never]);
    const res = await LIST(req());
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.phones).toEqual([]);
    expect(d.hours).toBe('شنبه تا پنج‌شنبه');
    expect(d.categories).toHaveLength(6);
    expect(d.tickets[0]).toMatchObject({ code: 'ZT-10001', icon: 'tOrders', unread: true, closed: false, preview: 'پشتیبانی: بررسی شد', status: { key: 'ANSWERED', tone: 'ok' } });
    expect(d.tickets[0].when).toMatch(/[۰-۹]/);
  });

  it('works without a workspace (contact card only)', async () => {
    vi.mocked(resolveSupportWorkspace).mockResolvedValue(null);
    const d = await (await LIST(req())).json();
    expect(d.tickets).toEqual([]);
    expect(listTickets).not.toHaveBeenCalled();
  });

  it('requires a session', async () => {
    vi.mocked(requireRequestUser).mockRejectedValue(new AppError('UNAUTHORIZED', 'x'));
    expect((await LIST(req())).status).toBe(401);
  });
});

describe('GET /api/v1/app/support/[id]', () => {
  it('returns the thread with mine/staff flags and marks it read', async () => {
    vi.mocked(getTicket).mockResolvedValue({ ...summary, messages: [
      { id: 'm1', authorKind: 'CUSTOMER', body: 'سلام', createdAt: '2026-10-08T08:00:00Z' },
      { id: 'm2', authorKind: 'STAFF', body: 'درود', createdAt: '2026-10-08T09:00:00Z' },
    ] } as never);
    const res = await ONE(req(), { params: Promise.resolve({ id: T }) });
    const d = await res.json();
    expect(getTicket).toHaveBeenCalledWith(WS, 'u1', T, { markRead: true });
    expect(d.ticket.messages.map((m: { mine: boolean }) => m.mine)).toEqual([true, false]);
    expect(d.ticket.order.code).toBe('ZP-333333');
  });

  it('answers 404 when the user has no workspace', async () => {
    vi.mocked(resolveSupportWorkspace).mockResolvedValue(null);
    expect((await ONE(req(), { params: Promise.resolve({ id: T }) })).status).toBe(404);
  });
});
