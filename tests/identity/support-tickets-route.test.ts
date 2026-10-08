import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/db', () => ({ query: vi.fn(), withTenantTransaction: vi.fn(), withUserTransaction: vi.fn() }));
vi.mock('../../server/core/distributed-rate-limit', () => ({ consumeDistributedRateLimit: vi.fn() }));
vi.mock('../../server/account/overview', () => ({ getViewer: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { assertSameOrigin } from '../../server/core/security-boundary';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { withTenantTransaction } from '../../server/core/db';
import { consumeDistributedRateLimit } from '../../server/core/distributed-rate-limit';
import { getViewer } from '../../server/account/overview';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockQuery = vi.fn();

const WS = '11111111-1111-4111-8111-111111111111';
const TICKET = '22222222-2222-4222-8222-222222222222';
const ORDER = '33333333-3333-4333-8333-333333333333';

/** Routes the tenant client's SQL to canned results; every statement is recorded. */
function sqlRouter(over: Partial<Record<'orders' | 'insertTicket' | 'select' | 'messages' | 'lock', unknown>> = {}) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (/FROM orders/.test(sql)) return over.orders ?? { rows: [{ '?column?': 1 }], rowCount: 1 };
    if (/INSERT INTO support_tickets/.test(sql)) return over.insertTicket ?? { rows: [{ id: TICKET, code: 'ZT-10001' }], rowCount: 1 };
    if (/INSERT INTO support_ticket_messages/.test(sql)) return { rows: [{ id: 'm-1', authorKind: 'CUSTOMER', body: 'x', createdAt: '2026-10-08' }], rowCount: 1 };
    if (/FOR UPDATE/.test(sql)) return over.lock ?? { rows: [{ id: TICKET, status: 'OPEN', code: 'ZT-10001' }], rowCount: 1 };
    if (/FROM support_ticket_messages WHERE ticket_id/.test(sql)) return over.messages ?? { rows: [], rowCount: 0 };
    if (/FROM support_tickets t/.test(sql)) return over.select ?? { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 1 };
  });
}
const calls = () => mockQuery.mock.calls as Array<[string, unknown[]]>;
const callFor = (re: RegExp) => calls().find(([sql]) => re.test(sql));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(withTenantTransaction).mockImplementation((async (_ws: string, _u: string | undefined, fn: (c: unknown) => unknown) => fn({ query: mockQuery })) as never);
  vi.mocked(getViewer).mockResolvedValue({ userId: 'user-1', displayName: 'علی', email: null, phone: null, workspaceId: WS, workspaceName: null });
  vi.mocked(consumeDistributedRateLimit).mockResolvedValue({ allowed: true, remaining: 5, resetAt: new Date() });
  sqlRouter();
});

type ListRoute = typeof import('../../app/api/v1/support/tickets/route');
type DetailRoute = typeof import('../../app/api/v1/support/tickets/[id]/route');
type ReplyRoute = typeof import('../../app/api/v1/support/tickets/[id]/messages/route');
type CloseRoute = typeof import('../../app/api/v1/support/tickets/[id]/close/route');
let GET: ListRoute['GET'];
let POST: ListRoute['POST'];
let GET_ONE: DetailRoute['GET'];
let REPLY: ReplyRoute['POST'];
let CLOSE: CloseRoute['POST'];

beforeAll(async () => {
  ({ GET, POST } = await import('../../app/api/v1/support/tickets/route'));
  ({ GET: GET_ONE } = await import('../../app/api/v1/support/tickets/[id]/route'));
  ({ POST: REPLY } = await import('../../app/api/v1/support/tickets/[id]/messages/route'));
  ({ POST: CLOSE } = await import('../../app/api/v1/support/tickets/[id]/close/route'));
}, 60000);

type Req = import('next/server').NextRequest;
function makeGetRequest(workspaceId?: string, path = '/api/v1/support/tickets'): Req {
  const url = new URL(`http://localhost:3000${path}`);
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  return { headers: { get: () => null }, nextUrl: url, url: url.toString(), method: 'GET' } as unknown as Req;
}
function makePostRequest(body: unknown, path = '/api/v1/support/tickets'): Req {
  return { json: async () => body, headers: { get: () => null }, url: `http://localhost:3000${path}`, method: 'POST' } as unknown as Req;
}
const ctx = (id = TICKET) => ({ params: Promise.resolve({ id }) });
const authed = () => { mockRequireUser.mockResolvedValue('user-1' as never); mockRequirePermission.mockResolvedValue(undefined as never); };

describe('GET /api/v1/support/tickets', () => {
  it('returns 200 with ticket list', async () => {
    authed();
    sqlRouter({ select: { rows: [{ id: TICKET, code: 'ZT-10001', subject: 'Help', status: 'OPEN', unread: false }], rowCount: 1 } });
    const res = await GET(makeGetRequest(WS));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({ subject: 'Help', code: 'ZT-10001' });
  });

  it('resolves the default workspace when workspaceId is omitted', async () => {
    authed();
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).workspaceId).toBe(WS);
    expect(mockRequirePermission).toHaveBeenCalledWith('user-1', WS, 'workspace.read');
  });

  it('returns an empty list when the user has no workspace', async () => {
    authed();
    vi.mocked(getViewer).mockResolvedValueOnce({ userId: 'user-1', displayName: 'x', email: null, phone: null, workspaceId: null, workspaceName: null });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).items).toEqual([]);
    expect(withTenantTransaction).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));
    const res = await GET(makeGetRequest(WS));
    expect(res.status).toBe(401);
  });

  it('returns 403 when lacking workspace.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));
    const res = await GET(makeGetRequest(WS));
    expect(res.status).toBe(403);
    expect(withTenantTransaction).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/support/tickets', () => {
  const validBody = { workspaceId: WS, subject: 'سفارش تحویل نشد', category: 'ORDER', orderId: ORDER, message: 'سفارش دیروز هنوز شروع نشده است.', priority: 'HIGH' };

  it('returns 201 with ticket id and code on success', async () => {
    authed();
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ticket).toEqual({ id: TICKET, code: 'ZT-10001' });
    expect(res.headers.get('x-correlation-id')).toBeTruthy();
  });

  // Regression: POST used to insert only subject/priority and silently drop the user's message and category.
  it('stores the first message, category and order with the ticket', async () => {
    authed();
    await POST(makePostRequest(validBody));
    const ticket = callFor(/INSERT INTO support_tickets/)!;
    expect(ticket[1]).toEqual([WS, 'user-1', 'سفارش تحویل نشد', 'HIGH', 'ORDER', ORDER]);
    const msg = callFor(/INSERT INTO support_ticket_messages/)!;
    expect(msg[0]).toContain("'CUSTOMER'");
    expect(msg[1]).toEqual([WS, TICKET, 'user-1', 'سفارش دیروز هنوز شروع نشده است.']);
    const audit = callFor(/INSERT INTO audit_logs/)!;
    expect(audit[1][2]).toBe('support.ticket.create');
  });

  it('rejects an order that is not in the workspace', async () => {
    authed();
    sqlRouter({ orders: { rows: [], rowCount: 0 } });
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(400);
    expect(callFor(/INSERT INTO support_tickets/)).toBeUndefined();
  });

  it('resolves the default workspace when workspaceId is omitted', async () => {
    authed();
    const { workspaceId: _omit, ...rest } = validBody;
    const res = await POST(makePostRequest(rest));
    expect(res.status).toBe(201);
    expect(mockRequirePermission).toHaveBeenCalledWith('user-1', WS, 'support.create');
  });

  it('returns 400 when the user has no workspace', async () => {
    authed();
    vi.mocked(getViewer).mockResolvedValueOnce({ userId: 'user-1', displayName: 'x', email: null, phone: null, workspaceId: null, workspaceName: null });
    const res = await POST(makePostRequest({ subject: 'Help', message: 'please help' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when subject is missing', async () => {
    authed();
    const res = await POST(makePostRequest({ workspaceId: WS, message: 'hello there' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when the message is missing or too short', async () => {
    authed();
    expect((await POST(makePostRequest({ workspaceId: WS, subject: 'Help' }))).status).toBe(400);
    expect((await POST(makePostRequest({ workspaceId: WS, subject: 'Help', message: ' a ' }))).status).toBe(400);
    expect(withTenantTransaction).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown category', async () => {
    authed();
    const res = await POST(makePostRequest({ ...validBody, category: 'REFUND_ME_NOW' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('defaults priority to NORMAL and category to OTHER when not provided', async () => {
    authed();
    await POST(makePostRequest({ workspaceId: WS, subject: 'Help', message: 'need help' }));
    const [, params] = callFor(/INSERT INTO support_tickets/)!;
    expect(params).toEqual([WS, 'user-1', 'Help', 'NORMAL', 'OTHER', null]);
  });

  it('returns 403 for a cross-origin browser mutation', async () => {
    vi.mocked(assertSameOrigin).mockImplementationOnce(() => { throw new AppError('FORBIDDEN', 'Cross-origin mutation rejected.'); });
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(403);
    expect(mockRequireUser).not.toHaveBeenCalled();
  });

  it('returns 429 when ticket creation is rate limited', async () => {
    authed();
    vi.mocked(consumeDistributedRateLimit).mockRejectedValueOnce(new AppError('RATE_LIMITED', 'Rate limit exceeded.'));
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(429);
    expect(withTenantTransaction).not.toHaveBeenCalled();
  });
});

describe('support_tickets RLS context', () => {
  // Regression: support_tickets has FORCE RLS; pool queries listed nothing and the insert was rejected.
  it('lists tickets inside the workspace context after the permission check', async () => {
    authed();
    await GET(makeGetRequest(WS));
    const mockTx = vi.mocked(withTenantTransaction);
    expect(mockTx).toHaveBeenCalledWith(WS, 'user-1', expect.any(Function));
    expect(mockRequirePermission.mock.invocationCallOrder[0]).toBeLessThan(mockTx.mock.invocationCallOrder[0]);
  });

  it('creates a ticket inside the workspace context', async () => {
    authed();
    const res = await POST(makePostRequest({ workspaceId: WS, subject: 'Need help', message: 'details here' }));
    expect(res.status).toBe(201);
    expect(vi.mocked(withTenantTransaction)).toHaveBeenCalledWith(WS, 'user-1', expect.any(Function));
  });
});

describe('GET /api/v1/support/tickets/[id]', () => {
  it('returns the thread and clears the unread staff-reply flag', async () => {
    authed();
    sqlRouter({
      select: { rows: [{ id: TICKET, code: 'ZT-10001', subject: 'Help', status: 'ANSWERED', unread: true }], rowCount: 1 },
      messages: { rows: [{ id: 'm1', authorKind: 'CUSTOMER', body: 'سلام', createdAt: 'a' }, { id: 'm2', authorKind: 'STAFF', body: 'درود', createdAt: 'b' }], rowCount: 2 },
    });
    const res = await GET_ONE(makeGetRequest(undefined, `/api/v1/support/tickets/${TICKET}`), ctx());
    expect(res.status).toBe(200);
    const { ticket } = await res.json();
    expect(ticket.messages.map((m: { authorKind: string }) => m.authorKind)).toEqual(['CUSTOMER', 'STAFF']);
    expect(ticket.unread).toBe(false);
    expect(callFor(/SET has_unread_staff_reply=false/)).toBeDefined();
    expect(JSON.stringify(ticket)).not.toContain('author_user_id');
  });

  it('returns 404 for another workspace\'s ticket (RLS hides it)', async () => {
    authed();
    const res = await GET_ONE(makeGetRequest(WS), ctx());
    expect(res.status).toBe(404);
  });

  it('returns 404 for a malformed id without touching the database', async () => {
    authed();
    const res = await GET_ONE(makeGetRequest(WS), ctx('not-a-uuid'));
    expect(res.status).toBe(404);
    expect(withTenantTransaction).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/support/tickets/[id]/messages', () => {
  it('adds a customer reply and moves the ticket to PENDING', async () => {
    authed();
    const res = await REPLY(makePostRequest({ body: 'هنوز مشکل دارم' }), ctx());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toMatchObject({ status: 'PENDING', reopened: false });
    expect(callFor(/INSERT INTO support_ticket_messages/)![1]).toEqual([WS, TICKET, 'user-1', 'هنوز مشکل دارم']);
    expect(callFor(/SET status='PENDING'/)).toBeDefined();
    expect(callFor(/INSERT INTO audit_logs/)![1][2]).toBe('support.ticket.reply');
  });

  it('reopens a closed ticket', async () => {
    authed();
    sqlRouter({ lock: { rows: [{ id: TICKET, status: 'CLOSED', code: 'ZT-10001' }], rowCount: 1 } });
    const res = await REPLY(makePostRequest({ body: 'دوباره سلام' }), ctx());
    expect((await res.json()).reopened).toBe(true);
    expect(callFor(/INSERT INTO audit_logs/)![1][2]).toBe('support.ticket.reopen');
  });

  it('returns 404 when the ticket is not visible', async () => {
    authed();
    sqlRouter({ lock: { rows: [], rowCount: 0 } });
    const res = await REPLY(makePostRequest({ body: 'hello' }), ctx());
    expect(res.status).toBe(404);
    expect(callFor(/INSERT INTO support_ticket_messages/)).toBeUndefined();
  });

  it('validates the reply body', async () => {
    authed();
    expect((await REPLY(makePostRequest({ body: '' }), ctx())).status).toBe(400);
    expect((await REPLY(makePostRequest({ body: 'x'.repeat(4001) }), ctx())).status).toBe(400);
  });

  it('enforces same-origin and the reply rate limit', async () => {
    vi.mocked(assertSameOrigin).mockImplementationOnce(() => { throw new AppError('FORBIDDEN', 'x'); });
    expect((await REPLY(makePostRequest({ body: 'hello' }), ctx())).status).toBe(403);
    authed();
    vi.mocked(consumeDistributedRateLimit).mockRejectedValueOnce(new AppError('RATE_LIMITED', 'x'));
    expect((await REPLY(makePostRequest({ body: 'hello' }), ctx())).status).toBe(429);
  });
});

describe('POST /api/v1/support/tickets/[id]/close', () => {
  it('closes an open ticket and audits it', async () => {
    authed();
    const res = await CLOSE(makePostRequest({}), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).ticket).toMatchObject({ id: TICKET, status: 'CLOSED', changed: true });
    expect(callFor(/SET status='CLOSED'/)).toBeDefined();
    expect(callFor(/INSERT INTO audit_logs/)![1][2]).toBe('support.ticket.close');
  });

  it('is idempotent for an already closed ticket', async () => {
    authed();
    sqlRouter({ lock: { rows: [{ id: TICKET, status: 'CLOSED', code: 'ZT-10001' }], rowCount: 1 } });
    const res = await CLOSE(makePostRequest({}), ctx());
    expect((await res.json()).ticket.changed).toBe(false);
    expect(callFor(/INSERT INTO audit_logs/)).toBeUndefined();
  });

  it('requires support.create permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));
    expect((await CLOSE(makePostRequest({ workspaceId: WS }), ctx())).status).toBe(403);
  });
});
