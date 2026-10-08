// Customer support tickets: a ticket is a conversation between the customer's workspace and ZOHALPAY staff.
// Every statement runs inside withTenantTransaction (support_tickets and support_ticket_messages are FORCE RLS),
// and every mutation writes its audit row in the same transaction. Callers authorize the workspace first.
//
// Status machine:
//   create (customer)        → OPEN
//   staff reply              → ANSWERED (+ unread flag for the customer)
//   customer reply           → PENDING  (also reopens a CLOSED ticket)
//   customer close           → CLOSED
import { isIP } from 'node:net';
import type { PoolClient } from 'pg';
import { withTenantTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { consumeDistributedRateLimit } from '../core/distributed-rate-limit';
import { BODY_MAX, BODY_MIN, SUBJECT_MAX } from '../../lib/support-ui';

export const SUPPORT_CATEGORIES = ['ORDER', 'PAYMENT', 'ACCOUNT', 'AI_SUBSCRIPTION', 'TECHNICAL', 'OTHER'] as const;
export type SupportCategory = typeof SUPPORT_CATEGORIES[number];
export type TicketStatus = 'OPEN' | 'ANSWERED' | 'PENDING' | 'CLOSED';
export type AuthorKind = 'CUSTOMER' | 'STAFF';

export { SUBJECT_MAX, BODY_MIN, BODY_MAX };

/** Rate limits per user: new tickets and replies (staff replies are not limited here). */
export const RATE_LIMITS = {
  create: { scope: 'support:ticket:create', windowSeconds: 3600, maxRequests: 8 },
  reply: { scope: 'support:ticket:reply', windowSeconds: 600, maxRequests: 30 },
} as const;

export type TicketSummary = {
  id: string; code: string; subject: string; status: TicketStatus; category: SupportCategory;
  orderId: string | null; createdAt: string; lastMessageAt: string; unread: boolean;
  /** Start of the latest message, for list rows. */
  preview: string | null; lastAuthor: AuthorKind | null;
};
export type TicketMessage = { id: string; authorKind: AuthorKind; body: string; createdAt: string };
export type TicketDetail = TicketSummary & { messages: TicketMessage[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string { return typeof v === 'string' && UUID_RE.test(v); }

/** Removes control characters (keeps newlines and tabs), normalises line endings and trims. */
export function cleanText(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

const len = (s: string) => Array.from(s).length;

export function validateSubject(v: unknown): string {
  const s = cleanText(v).replace(/\s+/g, ' ');
  if (!s) throw new AppError('VALIDATION_ERROR', 'موضوع تیکت را بنویسید.', { field: 'subject' });
  if (len(s) > SUBJECT_MAX) throw new AppError('VALIDATION_ERROR', `موضوع حداکثر ${SUBJECT_MAX.toLocaleString('fa-IR')} حرف است.`, { field: 'subject' });
  return s;
}

export function validateBody(v: unknown): string {
  const s = cleanText(v);
  if (len(s) < BODY_MIN) throw new AppError('VALIDATION_ERROR', 'متن پیام را بنویسید.', { field: 'message' });
  if (len(s) > BODY_MAX) throw new AppError('VALIDATION_ERROR', `متن پیام حداکثر ${BODY_MAX.toLocaleString('fa-IR')} حرف است.`, { field: 'message' });
  return s;
}

export function validateCategory(v: unknown): SupportCategory {
  const c = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (!c) return 'OTHER';
  if (!(SUPPORT_CATEGORIES as readonly string[]).includes(c)) throw new AppError('VALIDATION_ERROR', 'موضوع انتخاب‌شده معتبر نیست.', { field: 'category' });
  return c as SupportCategory;
}

function ticketIdOrNotFound(v: unknown): string {
  if (!isUuid(v)) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
  return v;
}

type Meta = { ip?: string; userAgent?: string };

/** audit_logs.ip is inet: clientFingerprint() yields 'unknown' without a trusted proxy, which must become NULL. */
const auditIp = (ip?: string) => (ip && isIP(ip) ? ip : undefined);

const SUMMARY_COLUMNS = `
  t.id, t.code, t.subject, t.status, t.category, t.order_id AS "orderId",
  t.created_at AS "createdAt", t.last_message_at AS "lastMessageAt", t.has_unread_staff_reply AS unread,
  lm.preview, lm.author_kind AS "lastAuthor"`;
const LAST_MESSAGE = `
  LEFT JOIN LATERAL (
    SELECT left(m.body, 120) AS preview, m.author_kind FROM support_ticket_messages m
    WHERE m.ticket_id=t.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1
  ) lm ON true`;

export async function listTickets(workspaceId: string, userId: string, opts: { limit?: number } = {}): Promise<TicketSummary[]> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? 30));
  return withTenantTransaction(workspaceId, userId, async client => {
    const r = await client.query<TicketSummary>(
      `SELECT ${SUMMARY_COLUMNS} FROM support_tickets t ${LAST_MESSAGE}
       WHERE t.workspace_id=$1
       ORDER BY (t.status='CLOSED'), t.last_message_at DESC LIMIT $2`,
      [workspaceId, limit],
    );
    return r.rows;
  });
}

async function loadTicket(client: PoolClient, workspaceId: string, ticketId: string, lock = false) {
  const r = await client.query<{ id: string; status: TicketStatus; code: string }>(
    `SELECT id, status, code FROM support_tickets WHERE id=$1 AND workspace_id=$2${lock ? ' FOR UPDATE' : ''}`,
    [ticketId, workspaceId],
  );
  const t = r.rows[0];
  if (!t) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
  return t;
}

/** Ticket with its full thread. With markRead the staff-reply unread flag is cleared in the same transaction. */
export async function getTicket(workspaceId: string, userId: string, ticketId: unknown, opts: { markRead?: boolean } = {}): Promise<TicketDetail> {
  const id = ticketIdOrNotFound(ticketId);
  return withTenantTransaction(workspaceId, userId, async client => {
    const t = await client.query<TicketSummary>(
      `SELECT ${SUMMARY_COLUMNS} FROM support_tickets t ${LAST_MESSAGE} WHERE t.id=$1 AND t.workspace_id=$2`,
      [id, workspaceId],
    );
    const ticket = t.rows[0];
    if (!ticket) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
    const m = await client.query<TicketMessage>(
      `SELECT id, author_kind AS "authorKind", body, created_at AS "createdAt"
       FROM support_ticket_messages WHERE ticket_id=$1 AND workspace_id=$2
       ORDER BY created_at ASC, id ASC LIMIT 500`,
      [id, workspaceId],
    );
    if (opts.markRead && ticket.unread) {
      await client.query(`UPDATE support_tickets SET has_unread_staff_reply=false WHERE id=$1 AND workspace_id=$2`, [id, workspaceId]);
    }
    return { ...ticket, unread: opts.markRead ? false : ticket.unread, messages: m.rows };
  });
}

export async function markTicketRead(workspaceId: string, userId: string, ticketId: unknown): Promise<void> {
  const id = ticketIdOrNotFound(ticketId);
  await withTenantTransaction(workspaceId, userId, client => client.query(
    `UPDATE support_tickets SET has_unread_staff_reply=false WHERE id=$1 AND workspace_id=$2 AND has_unread_staff_reply`,
    [id, workspaceId],
  ));
}

export type NewTicketInput = {
  workspaceId: string; userId: string;
  subject: unknown; category?: unknown; orderId?: unknown; message: unknown; priority?: unknown;
} & Meta;

/** Validates everything, then writes ticket + first message + audit row atomically. */
export async function createTicket(input: NewTicketInput): Promise<{ id: string; code: string }> {
  const subject = validateSubject(input.subject);
  const category = validateCategory(input.category);
  const body = validateBody(input.message);
  let orderId: string | null = null;
  if (input.orderId != null && input.orderId !== '') {
    if (!isUuid(input.orderId)) throw new AppError('VALIDATION_ERROR', 'سفارش انتخاب‌شده پیدا نشد.', { field: 'orderId' });
    orderId = input.orderId;
  }
  const p = typeof input.priority === 'string' ? input.priority.toUpperCase() : '';
  const priority = ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(p) ? p : 'NORMAL';

  await consumeDistributedRateLimit({ key: input.userId, ...RATE_LIMITS.create });

  return withTenantTransaction(input.workspaceId, input.userId, async client => {
    if (orderId) {
      // The order must belong to this workspace (RLS hides others; the explicit filter keeps intent clear).
      const o = await client.query(`SELECT 1 FROM orders WHERE id=$1 AND workspace_id=$2`, [orderId, input.workspaceId]);
      if (!o.rowCount) throw new AppError('VALIDATION_ERROR', 'سفارش انتخاب‌شده پیدا نشد.', { field: 'orderId' });
    }
    const t = await client.query<{ id: string; code: string }>(
      `INSERT INTO support_tickets(workspace_id, created_by_user_id, subject, status, priority, category, order_id, last_message_at)
       VALUES($1,$2,$3,'OPEN',$4,$5,$6,now()) RETURNING id, code`,
      [input.workspaceId, input.userId, subject, priority, category, orderId],
    );
    const ticket = t.rows[0];
    await client.query(
      `INSERT INTO support_ticket_messages(workspace_id, ticket_id, author_user_id, author_kind, body)
       VALUES($1,$2,$3,'CUSTOMER',$4)`,
      [input.workspaceId, ticket.id, input.userId, body],
    );
    await writeAudit({
      workspaceId: input.workspaceId, actorUserId: input.userId, action: 'support.ticket.create',
      entityType: 'support_ticket', entityId: ticket.id, ip: auditIp(input.ip), userAgent: input.userAgent,
      metadata: { code: ticket.code, category, orderId, priority },
    }, client);
    return ticket;
  });
}

export type ReplyInput = { workspaceId: string; userId: string; ticketId: unknown; body: unknown } & Meta;

/** Customer reply: always lands the ticket in PENDING (waiting on staff), reopening a closed one. */
export async function replyToTicket(input: ReplyInput): Promise<{ message: TicketMessage; status: TicketStatus; reopened: boolean }> {
  const id = ticketIdOrNotFound(input.ticketId);
  const body = validateBody(input.body);
  await consumeDistributedRateLimit({ key: input.userId, ...RATE_LIMITS.reply });
  return withTenantTransaction(input.workspaceId, input.userId, async client => {
    const t = await loadTicket(client, input.workspaceId, id, true);
    const m = await client.query<TicketMessage>(
      `INSERT INTO support_ticket_messages(workspace_id, ticket_id, author_user_id, author_kind, body)
       VALUES($1,$2,$3,'CUSTOMER',$4) RETURNING id, author_kind AS "authorKind", body, created_at AS "createdAt"`,
      [input.workspaceId, id, input.userId, body],
    );
    await client.query(
      `UPDATE support_tickets SET status='PENDING', last_message_at=now(), has_unread_staff_reply=false
       WHERE id=$1 AND workspace_id=$2`,
      [id, input.workspaceId],
    );
    const reopened = t.status === 'CLOSED';
    await writeAudit({
      workspaceId: input.workspaceId, actorUserId: input.userId, action: reopened ? 'support.ticket.reopen' : 'support.ticket.reply',
      entityType: 'support_ticket', entityId: id, ip: auditIp(input.ip), userAgent: input.userAgent,
      metadata: { code: t.code, from: t.status, to: 'PENDING', messageId: m.rows[0].id },
    }, client);
    return { message: m.rows[0], status: 'PENDING', reopened };
  });
}

/** Customer closes the ticket. Idempotent: closing a closed ticket changes nothing and writes no audit row. */
export async function closeTicket(input: { workspaceId: string; userId: string; ticketId: unknown } & Meta): Promise<{ status: 'CLOSED'; changed: boolean }> {
  const id = ticketIdOrNotFound(input.ticketId);
  return withTenantTransaction(input.workspaceId, input.userId, async client => {
    const t = await loadTicket(client, input.workspaceId, id, true);
    if (t.status === 'CLOSED') return { status: 'CLOSED', changed: false };
    await client.query(
      `UPDATE support_tickets SET status='CLOSED', has_unread_staff_reply=false WHERE id=$1 AND workspace_id=$2`,
      [id, input.workspaceId],
    );
    await writeAudit({
      workspaceId: input.workspaceId, actorUserId: input.userId, action: 'support.ticket.close',
      entityType: 'support_ticket', entityId: id, ip: auditIp(input.ip), userAgent: input.userAgent,
      metadata: { code: t.code, from: t.status },
    }, client);
    return { status: 'CLOSED', changed: true };
  });
}

/**
 * Staff reply, for the future admin app. Deliberately NOT exposed over HTTP yet: the admin surface must
 * authorize the staff member (platform role) before calling this. Marks the ticket ANSWERED and unread.
 */
export async function addStaffReply(input: { workspaceId: string; staffUserId: string; ticketId: unknown; body: unknown } & Meta): Promise<TicketMessage> {
  const id = ticketIdOrNotFound(input.ticketId);
  const body = validateBody(input.body);
  return withTenantTransaction(input.workspaceId, input.staffUserId, async client => {
    const t = await loadTicket(client, input.workspaceId, id, true);
    const m = await client.query<TicketMessage>(
      `INSERT INTO support_ticket_messages(workspace_id, ticket_id, author_user_id, author_kind, body)
       VALUES($1,$2,$3,'STAFF',$4) RETURNING id, author_kind AS "authorKind", body, created_at AS "createdAt"`,
      [input.workspaceId, id, input.staffUserId, body],
    );
    await client.query(
      `UPDATE support_tickets SET status='ANSWERED', last_message_at=now(), has_unread_staff_reply=true
       WHERE id=$1 AND workspace_id=$2`,
      [id, input.workspaceId],
    );
    await writeAudit({
      workspaceId: input.workspaceId, actorUserId: input.staffUserId, action: 'support.ticket.staff_reply',
      entityType: 'support_ticket', entityId: id, ip: auditIp(input.ip), userAgent: input.userAgent,
      metadata: { code: t.code, from: t.status, to: 'ANSWERED', messageId: m.rows[0].id },
    }, client);
    return m.rows[0];
  });
}
