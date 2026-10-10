import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/support/tickets', () => ({ addStaffReply: vi.fn() }));
vi.mock('../../server/notifications/inbox', () => ({ notifyUser: vi.fn() }));
vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withTenantTransaction: vi.fn(async (_w: string, _u: string, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});
import { requirePlatformAdmin } from '../../server/identity/platform-admin';
import { writeAudit } from '../../server/core/audit';
import { query } from '../../server/core/db';
import { addStaffReply } from '../../server/support/tickets';
import { notifyUser } from '../../server/notifications/inbox';
import { assignTicket, listAdminTickets, replyAsStaff, setTicketStatus } from '../../server/admin/support';

const A = '11111111-1111-4111-8111-111111111111';
const B = '12111111-1111-4111-8111-111111111111';
const T = '50000000-0000-4000-8000-000000000005';
const W = '30000000-0000-4000-8000-000000000003';
const q = vi.mocked(query);
const route = (extra: (sql: string) => unknown) => q.mockImplementation((async (sql: string) => /system_admin_ticket_workspace/.test(sql) ? { rows: [{ workspace_id: W }] } : (extra(sql) ?? { rows: [] })) as never);
beforeEach(() => { vi.resetAllMocks(); route(() => undefined); });

describe('admin support desk', () => {
  it('list filters are validated before they reach SQL', async () => {
    await listAdminTickets(A, { status: 'DROP', assignee: 'x', search: ' علی ', page: 3 });
    const a = q.mock.calls[0][1] as unknown[];
    expect(a[0]).toBeNull(); expect(a[1]).toBe('علی'); expect(a[2]).toBeNull(); expect(a[4]).toBe(50);
  });
  it('every action requires platform_admin', async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new Error('FORBIDDEN'));
    await expect(setTicketStatus({ actorUserId: A, ticketId: T, status: 'CLOSED' })).rejects.toThrow('FORBIDDEN');
    await expect(replyAsStaff({ actorUserId: A, ticketId: T, body: 'x' })).rejects.toThrow('FORBIDDEN');
    expect(addStaffReply).not.toHaveBeenCalled();
  });
  it('reply uses the existing staff-reply service inside the ticket workspace and auto-assigns', async () => {
    vi.mocked(addStaffReply).mockResolvedValue({ id: 'm1' } as never);
    await replyAsStaff({ actorUserId: A, ticketId: T, body: 'سلام' });
    expect(addStaffReply).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: W, staffUserId: A, ticketId: T }));
    expect(q.mock.calls.some(c => /assigned_to_user_id IS NULL/.test(String(c[0])))).toBe(true);
  });
  it('closing notifies the customer and audits; repeating is a no-op', async () => {
    route(sql => /FROM support_tickets/.test(sql) ? { rows: [{ status: 'ANSWERED', code: 'ZT-1', uid: B }] } : undefined);
    expect(await setTicketStatus({ actorUserId: A, ticketId: T, status: 'CLOSED' })).toEqual({ status: 'CLOSED', changed: true });
    expect(notifyUser).toHaveBeenCalledWith(expect.objectContaining({ type: 'support.closed', userId: B }), expect.anything());
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.ticket.status' }), expect.anything());
    vi.mocked(notifyUser).mockClear();
    route(sql => /FROM support_tickets/.test(sql) ? { rows: [{ status: 'CLOSED', code: 'ZT-1', uid: B }] } : undefined);
    expect((await setTicketStatus({ actorUserId: A, ticketId: T, status: 'CLOSED' })).changed).toBe(false);
    expect(notifyUser).not.toHaveBeenCalled();
  });
  it('rejects unknown statuses', async () => {
    await expect(setTicketStatus({ actorUserId: A, ticketId: T, status: 'ANSWERED' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('assignment audits from/to and only accepts team members', async () => {
    route(sql => /FROM support_tickets/.test(sql) ? { rows: [{ code: 'ZT-1', assigned_to_user_id: null }] } : undefined);
    expect((await assignTicket({ actorUserId: A, ticketId: T, assigneeId: B })).changed).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.ticket.assign', metadata: expect.objectContaining({ to: B }) }), expect.anything());
    await expect(assignTicket({ actorUserId: A, ticketId: T, assigneeId: 'nope' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    vi.mocked(requirePlatformAdmin).mockImplementation(async (id: string) => { if (id === B) throw new Error('no'); });
    await expect(assignTicket({ actorUserId: A, ticketId: T, assigneeId: B })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
