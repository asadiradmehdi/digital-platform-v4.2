// Admin support desk on top of the existing ticket tables and services (server/support/tickets.ts).
// Lists use the SECURITY DEFINER routing functions (migration 0064); per-ticket work happens inside the ticket's tenant
// transaction. Staff replies go through addStaffReply (which notifies the customer and audits); status and assignment
// changes are audited here.
import { query, withTenantTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { getAdminAccess, requirePermission } from './access';
import { addStaffReply } from '../support/tickets';
import { notifyUser } from '../notifications/inbox';
import { clampPage, PAGE_SIZE } from './console';

export { PAGE_SIZE };
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const TICKET_FILTERS = ['ACTIVE', 'OPEN', 'PENDING', 'ANSWERED', 'CLOSED'] as const;

export type AdminTicketRow = {
  ticketId: string; code: string; subject: string; status: string; category: string; priority: string; createdAt: string; lastMessageAt: string;
  customerName: string | null; customerPhone: string | null; assignedTo: string | null; assignedName: string | null; lastAuthor: string | null; preview: string | null;
};

export async function listAdminTickets(actorUserId: string, f: { status?: string | null; search?: string | null; assignee?: string | null; page?: number }) {
  await requirePermission(actorUserId, 'support.view');
  const status = f.status && (TICKET_FILTERS as readonly string[]).includes(f.status) ? f.status : null;
  const assignee = f.assignee === 'none' ? 'none' : isUuid(f.assignee) ? f.assignee : null;
  const search = (f.search ?? '').trim().slice(0, 80) || null;
  const page = clampPage(f.page);
  const r = await query<{
    ticket_id: string; code: string; subject: string; status: string; category: string; priority: string; created_at: string; last_message_at: string;
    customer_name: string | null; customer_phone: string | null; assigned_to_user_id: string | null; assigned_name: string | null; last_author: string | null; preview: string | null; total_count: string;
  }>(`SELECT * FROM system_admin_tickets($1,$2,$3,NULL,$4,$5)`, [status, search, assignee, PAGE_SIZE, (page - 1) * PAGE_SIZE]);
  return {
    page, total: Number(r.rows[0]?.total_count ?? 0),
    rows: r.rows.map((x): AdminTicketRow => ({
      ticketId: x.ticket_id, code: x.code, subject: x.subject, status: x.status, category: x.category, priority: x.priority, createdAt: x.created_at, lastMessageAt: x.last_message_at,
      customerName: x.customer_name, customerPhone: x.customer_phone, assignedTo: x.assigned_to_user_id, assignedName: x.assigned_name, lastAuthor: x.last_author, preview: x.preview,
    })),
  };
}

/** People a ticket can be assigned to: the owner(s) and active staff who may handle tickets. */
export async function listStaff(actorUserId: string): Promise<{ id: string; name: string }[]> {
  await requirePermission(actorUserId, 'support.view');
  const r = await query<{ id: string; name: string }>(
    `SELECT u.id, COALESCE(NULLIF(u.display_name,''), u.phone, u.email, 'مدیر') AS name FROM users u
     WHERE u.status='ACTIVE' AND (
       EXISTS (SELECT 1 FROM workspace_members wm JOIN member_roles mr ON mr.member_id=wm.id JOIN roles r ON r.id=mr.role_id
               WHERE wm.user_id=u.id AND wm.status='ACTIVE' AND r.name='platform_admin' AND r.workspace_id IS NULL AND r.is_system=true)
       OR EXISTS (SELECT 1 FROM staff_members sm WHERE sm.user_id=u.id AND sm.status='ACTIVE' AND 'support.manage' = ANY(sm.permissions)))
     ORDER BY name`);
  return r.rows;
}

async function resolveTicket(ticketId: string): Promise<string> {
  if (!isUuid(ticketId)) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
  const r = await query<{ workspace_id: string }>(`SELECT * FROM system_admin_ticket_workspace($1)`, [ticketId]);
  if (!r.rows[0]) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
  return r.rows[0].workspace_id;
}

export type AdminTicketDetail = {
  id: string; workspaceId: string; code: string; subject: string; status: string; category: string; priority: string; createdAt: string;
  orderId: string | null; customer: { userId: string; name: string | null; phone: string | null };
  assignedTo: string | null; assignedName: string | null;
  messages: { id: string; authorKind: 'CUSTOMER' | 'STAFF'; authorName: string | null; body: string; createdAt: string }[];
};

export async function getAdminTicket(actorUserId: string, ticketId: string): Promise<AdminTicketDetail> {
  await requirePermission(actorUserId, 'support.view');
  const workspaceId = await resolveTicket(ticketId);
  return withTenantTransaction(workspaceId, actorUserId, async c => {
    const t = (await c.query<{ id: string; code: string; subject: string; status: string; category: string; priority: string; created_at: string; order_id: string | null; uid: string; cname: string | null; cphone: string | null; assigned_to_user_id: string | null; aname: string | null }>(
      `SELECT t.id, t.code, t.subject, t.status, t.category, t.priority, t.created_at::text, t.order_id, t.created_by_user_id AS uid, cu.display_name AS cname, cu.phone AS cphone,
              t.assigned_to_user_id, au.display_name AS aname
       FROM support_tickets t LEFT JOIN users cu ON cu.id=t.created_by_user_id LEFT JOIN users au ON au.id=t.assigned_to_user_id WHERE t.id=$1`, [ticketId])).rows[0];
    if (!t) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
    const m = await c.query<{ id: string; author_kind: 'CUSTOMER' | 'STAFF'; author_name: string | null; body: string; created_at: string }>(
      `SELECT m.id, m.author_kind, u.display_name AS author_name, m.body, m.created_at::text FROM support_ticket_messages m LEFT JOIN users u ON u.id=m.author_user_id
       WHERE m.ticket_id=$1 ORDER BY m.created_at, m.id LIMIT 500`, [ticketId]);
    return {
      id: t.id, workspaceId, code: t.code, subject: t.subject, status: t.status, category: t.category, priority: t.priority, createdAt: t.created_at, orderId: t.order_id,
      customer: { userId: t.uid, name: t.cname, phone: t.cphone }, assignedTo: t.assigned_to_user_id, assignedName: t.aname,
      messages: m.rows.map(x => ({ id: x.id, authorKind: x.author_kind, authorName: x.author_name, body: x.body, createdAt: x.created_at })),
    };
  });
}

/** Staff reply: the thread gets the message, status becomes ANSWERED, the customer is notified. The first reply also assigns the ticket to the replier. */
export async function replyAsStaff(input: { actorUserId: string; ticketId: string; body: unknown }) {
  await requirePermission(input.actorUserId, 'support.manage');
  const workspaceId = await resolveTicket(input.ticketId);
  const msg = await addStaffReply({ workspaceId, staffUserId: input.actorUserId, ticketId: input.ticketId, body: input.body });
  await withTenantTransaction(workspaceId, input.actorUserId, c => c.query(
    `UPDATE support_tickets SET assigned_to_user_id=$2, assigned_at=now() WHERE id=$1 AND assigned_to_user_id IS NULL`, [input.ticketId, input.actorUserId]));
  return msg;
}

/** Close, or reopen a ticket (OPEN). Customer is told when the ticket is closed by staff. */
export async function setTicketStatus(input: { actorUserId: string; ticketId: string; status: unknown }) {
  await requirePermission(input.actorUserId, 'support.manage');
  if (input.status !== 'CLOSED' && input.status !== 'OPEN') throw new AppError('VALIDATION_ERROR', 'وضعیت نامعتبر است.');
  const to = input.status;
  const workspaceId = await resolveTicket(input.ticketId);
  return withTenantTransaction(workspaceId, input.actorUserId, async c => {
    const t = (await c.query<{ status: string; code: string; uid: string }>(`SELECT status, code, created_by_user_id AS uid FROM support_tickets WHERE id=$1 AND workspace_id=$2 FOR UPDATE`, [input.ticketId, workspaceId])).rows[0];
    if (!t) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
    if (t.status === to) return { status: to, changed: false };
    await c.query(`UPDATE support_tickets SET status=$3, updated_at=now() WHERE id=$1 AND workspace_id=$2`, [input.ticketId, workspaceId, to]);
    if (to === 'CLOSED') {
      await notifyUser({ workspaceId, userId: t.uid, type: 'support.closed', category: 'support', title: `تیکت ${t.code} بسته شد`, link: `/support/${input.ticketId}` }, c);
    }
    await writeAudit({ workspaceId, actorUserId: input.actorUserId, action: 'admin.ticket.status', entityType: 'support_ticket', entityId: input.ticketId, metadata: { code: t.code, from: t.status, to } }, c);
    return { status: to, changed: true };
  });
}

/** Assigns the ticket to a platform admin (or clears it with null). */
export async function assignTicket(input: { actorUserId: string; ticketId: string; assigneeId: unknown }) {
  await requirePermission(input.actorUserId, 'support.manage');
  const assignee = input.assigneeId === null || input.assigneeId === '' ? null : isUuid(input.assigneeId) ? input.assigneeId : undefined;
  if (assignee === undefined) throw new AppError('VALIDATION_ERROR', 'مسئول نامعتبر است.');
  if (assignee) {
    const who = await getAdminAccess(assignee).catch(() => null);
    if (!who || !who.permissions.has('support.manage')) throw new AppError('VALIDATION_ERROR', 'مسئول باید از تیم پشتیبانی باشد.');
  }
  const workspaceId = await resolveTicket(input.ticketId);
  return withTenantTransaction(workspaceId, input.actorUserId, async c => {
    const t = (await c.query<{ code: string; assigned_to_user_id: string | null }>(`SELECT code, assigned_to_user_id FROM support_tickets WHERE id=$1 AND workspace_id=$2 FOR UPDATE`, [input.ticketId, workspaceId])).rows[0];
    if (!t) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
    if (t.assigned_to_user_id === assignee) return { assignedTo: assignee, changed: false };
    await c.query(`UPDATE support_tickets SET assigned_to_user_id=$3, assigned_at=CASE WHEN $3::uuid IS NULL THEN NULL ELSE now() END WHERE id=$1 AND workspace_id=$2`, [input.ticketId, workspaceId, assignee]);
    await writeAudit({ workspaceId, actorUserId: input.actorUserId, action: 'admin.ticket.assign', entityType: 'support_ticket', entityId: input.ticketId, metadata: { code: t.code, from: t.assigned_to_user_id, to: assignee } }, c);
    return { assignedTo: assignee, changed: true };
  });
}
