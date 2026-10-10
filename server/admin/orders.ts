// Admin order desk: search, full detail, status moves along the state machine, internal notes, delivery with proof,
// and refund/cancel through the existing payments service. Orders are FORCE-RLS: the workspace is resolved through the
// routing function, then all per-order work runs in that tenant's transaction. Customers are told by the orders.status
// trigger (customer_message_events -> inbox + SMS); delivery proof adds an inbox message.
import { query, withTenantTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { canTransitionOrder, ORDER_STATUSES, type OrderStatus } from '../core/order-state';
import { requirePlatformAdmin } from '../identity/platform-admin';
import { completeManualOrder } from '../commerce/fulfilment';
import { refundOrder } from '../payments/refund';
import { notifyUser } from '../notifications/inbox';
import { clampPage, PAGE_SIZE } from './console';

export { ORDER_STATUSES, PAGE_SIZE };

/** Moves an operator may make by hand. Money moves (cancel/refund) go through refundOrder; COMPLETED through «تحویل». */
export const MANUAL_STATUS_TARGETS: readonly OrderStatus[] = ['QUEUED', 'PROCESSING', 'IN_PROGRESS', 'FAILED'];
export const STALE_HOURS = 6;

export type OrderFilters = {
  status?: string | null; search?: string | null; category?: string | null; attention?: boolean; userId?: string | null;
  from?: string | null; to?: string | null; page?: number;
};
export type OrderListRow = {
  orderId: string; status: string; totalToman: number; createdAt: string; updatedAt: string; ownerName: string | null; ownerPhone: string | null;
  serviceName: string | null; productSlug: string | null; quantity: number | null; fulfillmentMode: string | null; code: string;
};

export const orderCode = (id: string) => `ZP-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function searchOrders(actorUserId: string, f: OrderFilters): Promise<{ rows: OrderListRow[]; total: number; page: number }> {
  await requirePlatformAdmin(actorUserId);
  const status = f.status && (ORDER_STATUSES as readonly string[]).includes(f.status) ? f.status : null;
  const page = clampPage(f.page);
  const search = (f.search ?? '').trim().slice(0, 80) || null;
  const category = f.category && /^[a-z0-9-]{1,40}$/.test(f.category) ? f.category : null;
  const user = isUuid(f.userId) ? f.userId : null;
  const from = isDay(f.from) ? `${f.from}T00:00:00+03:30` : null;
  const to = isDay(f.to) ? new Date(new Date(`${f.to}T00:00:00+03:30`).getTime() + 86_400_000).toISOString() : null;
  const r = await query<{
    order_id: string; status: string; total_toman: string; created_at: string; updated_at: string; owner_name: string | null; owner_phone: string | null;
    service_name: string | null; product_slug: string | null; quantity: string | null; fulfillment_mode: string | null; total_count: string;
  }>(`SELECT * FROM system_admin_order_search($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [status, search, category, user, from, to, Boolean(f.attention), STALE_HOURS, PAGE_SIZE, (page - 1) * PAGE_SIZE]);
  return {
    page, total: Number(r.rows[0]?.total_count ?? 0),
    rows: r.rows.map(x => ({
      orderId: x.order_id, status: x.status, totalToman: Math.round(Number(x.total_toman)), createdAt: x.created_at, updatedAt: x.updated_at,
      ownerName: x.owner_name, ownerPhone: x.owner_phone, serviceName: x.service_name, productSlug: x.product_slug,
      quantity: x.quantity == null ? null : Number(x.quantity), fulfillmentMode: x.fulfillment_mode, code: orderCode(x.order_id),
    })),
  };
}

async function resolveOrder(orderId: string): Promise<{ workspaceId: string; ownerUserId: string }> {
  if (!isUuid(orderId)) throw new AppError('VALIDATION_ERROR', 'شناسه‌ی سفارش نامعتبر است.');
  const r = await query<{ workspace_id: string; owner_user_id: string }>(`SELECT * FROM system_admin_order_workspace($1)`, [orderId]);
  if (!r.rows[0]) throw new AppError('NOT_FOUND', 'سفارش پیدا نشد.');
  return { workspaceId: r.rows[0].workspace_id, ownerUserId: r.rows[0].owner_user_id };
}

export type OrderDetail = {
  id: string; code: string; workspaceId: string; status: string; currency: string; totalToman: number; subtotalToman: number; discountToman: number;
  createdAt: string; updatedAt: string; riskState: string;
  customer: { userId: string; name: string | null; phone: string | null; email: string | null };
  items: { id: string; serviceId: string; serviceName: string; productSlug: string; fulfillmentMode: string; quantity: number; unitToman: number; totalToman: number; costToman: number | null; parameters: Record<string, unknown> }[];
  payments: { id: string; status: string; gateway: string; amountToman: number; reference: string | null; createdAt: string; refundedToman: number }[];
  refunds: { id: string; status: string; amountToman: number; createdAt: string }[];
  events: { id: string; from: string | null; to: string; actorName: string | null; createdAt: string; note: string | null; proofUrl: string | null; source: string | null }[];
  notes: { id: string; body: string; authorName: string | null; createdAt: string }[];
  allowedTargets: OrderStatus[];
  canDeliver: boolean; canCancel: boolean; canRefund: boolean; refundableToman: number;
};

const toToman = (minor: string | number, currency: string) => Math.round(Number(minor) / (currency.trim() === 'IRR' ? 10 : 1));
const CANCEL_STATES = ['CREATED', 'PAYMENT_PENDING', 'PAID', 'QUEUED'];
const REFUND_STATES = ['PAID', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'REFUND_PENDING'];

export async function getOrderDetail(actorUserId: string, orderId: string): Promise<OrderDetail> {
  await requirePlatformAdmin(actorUserId);
  const { workspaceId, ownerUserId } = await resolveOrder(orderId);
  return withTenantTransaction(workspaceId, actorUserId, async c => {
    const o = (await c.query<{ id: string; status: string; currency: string; subtotal_minor: string; discount_minor: string; total_minor: string; risk_state: string; created_at: string; updated_at: string }>(
      `SELECT id, status::text, currency, subtotal_minor::text, discount_minor::text, total_minor::text, risk_state::text, created_at::text, updated_at::text FROM orders WHERE id=$1`, [orderId])).rows[0];
    if (!o) throw new AppError('NOT_FOUND', 'سفارش پیدا نشد.');
    const cur = o.currency.trim();
    const cust = await c.query<{ id: string; display_name: string | null; phone: string | null; email: string | null }>(`SELECT id, display_name, phone, email FROM users WHERE id=$1`, [ownerUserId]);
    const items = await c.query<{ id: string; service_id: string; name: string; slug: string; fulfillment_mode: string; quantity: string; unit_price_minor: string; total_minor: string; provider_cost_minor: string | null; provider_cost_currency: string | null; parameters: Record<string, unknown> }>(
      `SELECT oi.id, oi.service_id, s.name, p.slug, s.fulfillment_mode, oi.quantity::text, oi.unit_price_minor::text, oi.total_minor::text, oi.provider_cost_minor::text, oi.provider_cost_currency, oi.parameters
       FROM order_items oi JOIN services s ON s.id=oi.service_id JOIN products p ON p.id=s.product_id WHERE oi.order_id=$1 ORDER BY oi.id`, [orderId]);
    const pays = await c.query<{ id: string; status: string; gateway: string; amount_minor: string; currency: string; gateway_reference: string | null; created_at: string }>(
      `SELECT id, status::text, gateway, amount_minor::text, currency, gateway_reference, created_at::text FROM payments WHERE order_id=$1 ORDER BY created_at`, [orderId]);
    const refs = await c.query<{ id: string; payment_id: string; status: string; amount_minor: string; currency: string; created_at: string }>(
      `SELECT r.id, r.payment_id, r.status::text, r.amount_minor::text, r.currency, r.created_at::text FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.order_id=$1 ORDER BY r.created_at`, [orderId]);
    const evs = await c.query<{ id: string; from_status: string | null; to_status: string; actor_name: string | null; created_at: string; metadata: Record<string, unknown> }>(
      `SELECT e.id, e.from_status::text, e.to_status::text, u.display_name AS actor_name, e.created_at::text, e.metadata
       FROM order_events e LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.order_id=$1 ORDER BY e.created_at, e.id`, [orderId]);
    const notes = await c.query<{ id: string; body: string; author_name: string | null; created_at: string }>(
      `SELECT n.id, n.body, u.display_name AS author_name, n.created_at::text FROM admin_order_notes n LEFT JOIN users u ON u.id=n.author_user_id WHERE n.order_id=$1 ORDER BY n.created_at DESC`, [orderId]);

    const refundedBy = new Map<string, number>();
    for (const r of refs.rows) if (r.status !== 'FAILED') refundedBy.set(r.payment_id, (refundedBy.get(r.payment_id) ?? 0) + toToman(r.amount_minor, r.currency));
    const payments = pays.rows.map(p => ({ id: p.id, status: p.status, gateway: p.gateway, amountToman: toToman(p.amount_minor, p.currency), reference: p.gateway_reference, createdAt: p.created_at, refundedToman: refundedBy.get(p.id) ?? 0 }));
    const paid = payments.filter(p => p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED');
    const refundableToman = paid.reduce((a, p) => a + Math.max(0, p.amountToman - p.refundedToman), 0);
    const mode = items.rows[0]?.fulfillment_mode;
    const status = o.status as OrderStatus;
    return {
      id: o.id, code: orderCode(o.id), workspaceId, status: o.status, currency: cur, totalToman: toToman(o.total_minor, cur), subtotalToman: toToman(o.subtotal_minor, cur), discountToman: toToman(o.discount_minor, cur),
      createdAt: o.created_at, updatedAt: o.updated_at, riskState: o.risk_state,
      customer: { userId: ownerUserId, name: cust.rows[0]?.display_name ?? null, phone: cust.rows[0]?.phone ?? null, email: cust.rows[0]?.email ?? null },
      items: items.rows.map(i => ({
        id: i.id, serviceId: i.service_id, serviceName: i.name, productSlug: i.slug, fulfillmentMode: i.fulfillment_mode, quantity: Number(i.quantity),
        unitToman: toToman(i.unit_price_minor, cur), totalToman: toToman(i.total_minor, cur),
        costToman: i.provider_cost_minor == null ? null : toToman(i.provider_cost_minor, i.provider_cost_currency ?? cur), parameters: i.parameters ?? {},
      })),
      payments,
      refunds: refs.rows.map(r => ({ id: r.id, status: r.status, amountToman: toToman(r.amount_minor, r.currency), createdAt: r.created_at })),
      events: evs.rows.map(e => ({
        id: e.id, from: e.from_status, to: e.to_status, actorName: e.actor_name, createdAt: e.created_at,
        note: typeof e.metadata?.note === 'string' ? e.metadata.note : null, proofUrl: typeof e.metadata?.proofUrl === 'string' ? e.metadata.proofUrl : null,
        source: typeof e.metadata?.source === 'string' ? e.metadata.source : null,
      })),
      notes: notes.rows.map(n => ({ id: n.id, body: n.body, authorName: n.author_name, createdAt: n.created_at })),
      allowedTargets: MANUAL_STATUS_TARGETS.filter(t => canTransitionOrder(status, t)),
      canDeliver: mode === 'MANUAL' && (status === 'QUEUED' || status === 'IN_PROGRESS'),
      canCancel: CANCEL_STATES.includes(o.status),
      canRefund: REFUND_STATES.includes(o.status) && refundableToman > 0,
      refundableToman,
    };
  });
}

const cleanText = (v: unknown, label: string, max: number, required = false): string | null => {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) { if (required) throw new AppError('VALIDATION_ERROR', `${label} را وارد کنید.`); return null; }
  if (typeof v !== 'string') throw new AppError('VALIDATION_ERROR', `${label} معتبر نیست.`);
  const t = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (Array.from(t).length > max) throw new AppError('VALIDATION_ERROR', `${label} حداکثر ${max} حرف است.`);
  return t;
};

/** Only https links: the proof is shown to the customer, so no javascript:/data: and no plain http. */
export function cleanProofUrl(v: unknown): string | null {
  const t = cleanText(v, 'لینک مدرک', 500);
  if (!t) return null;
  let u: URL;
  try { u = new URL(t); } catch { throw new AppError('VALIDATION_ERROR', 'لینک مدرک معتبر نیست.'); }
  if (u.protocol !== 'https:' || u.username || u.password) throw new AppError('VALIDATION_ERROR', 'لینک مدرک باید با https شروع شود.');
  return u.toString();
}

export async function addOrderNote(input: { actorUserId: string; orderId: string; body: unknown }) {
  await requirePlatformAdmin(input.actorUserId);
  const body = cleanText(input.body, 'یادداشت', 2000, true)!;
  const { workspaceId } = await resolveOrder(input.orderId);
  return withTenantTransaction(workspaceId, input.actorUserId, async c => {
    const r = await c.query<{ id: string }>(`INSERT INTO admin_order_notes(order_id, author_user_id, body) VALUES($1,$2,$3) RETURNING id`, [input.orderId, input.actorUserId, body]);
    await writeAudit({ workspaceId, actorUserId: input.actorUserId, action: 'admin.order.note', entityType: 'order', entityId: input.orderId, metadata: { noteId: r.rows[0].id, length: body.length } }, c);
    return { id: r.rows[0].id };
  });
}

/** Operator status move along the state machine (never into money states or COMPLETED; those have their own actions). */
export async function changeOrderStatus(input: { actorUserId: string; orderId: string; to: unknown; note?: unknown }) {
  await requirePlatformAdmin(input.actorUserId);
  const to = input.to as OrderStatus;
  if (typeof to !== 'string' || !MANUAL_STATUS_TARGETS.includes(to)) throw new AppError('VALIDATION_ERROR', 'این وضعیت را نمی‌توان دستی تعیین کرد. برای لغو، بازگشت وجه و تحویل از دکمه‌ی خودشان استفاده کنید.');
  const note = cleanText(input.note, 'یادداشت', 500);
  const { workspaceId } = await resolveOrder(input.orderId);
  return withTenantTransaction(workspaceId, input.actorUserId, async c => {
    const cur = (await c.query<{ status: OrderStatus }>(`SELECT status::text FROM orders WHERE id=$1 FOR UPDATE`, [input.orderId])).rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'سفارش پیدا نشد.');
    if (cur.status === to) return { id: input.orderId, status: to, changed: false };
    if (!canTransitionOrder(cur.status, to)) throw new AppError('CONFLICT', `از «${cur.status}» به «${to}» نمی‌توان رفت.`, { from: cur.status, to });
    await c.query(`UPDATE orders SET status=$2, updated_at=now() WHERE id=$1`, [input.orderId, to]);
    await c.query(`INSERT INTO order_events(order_id, from_status, to_status, actor_user_id, metadata) VALUES($1,$2,$3,$4,$5)`,
      [input.orderId, cur.status, to, input.actorUserId, { source: 'admin', ...(note ? { note } : {}) }]);
    await writeAudit({ workspaceId, actorUserId: input.actorUserId, action: 'admin.order.status', entityType: 'order', entityId: input.orderId, metadata: { from: cur.status, to, note } }, c);
    return { id: input.orderId, status: to, changed: true };
  });
}

/** Delivery of a team-fulfilled order with an optional note and proof link. The customer gets the status message plus the note. */
export async function deliverOrder(input: { actorUserId: string; orderId: string; note?: unknown; proofUrl?: unknown }) {
  await requirePlatformAdmin(input.actorUserId);
  const note = cleanText(input.note, 'توضیح تحویل', 500);
  const proofUrl = cleanProofUrl(input.proofUrl);
  const { workspaceId, ownerUserId } = await resolveOrder(input.orderId);
  const r = await completeManualOrder({ orderId: input.orderId, workspaceId, actorUserId: input.actorUserId, note: note ?? undefined, proofUrl: proofUrl ?? undefined });
  if (r.changed && (note || proofUrl)) {
    await notifyUser({
      workspaceId, userId: ownerUserId, type: 'order.delivery_note', category: 'orders', title: `تحویل سفارش ${orderCode(input.orderId)}`,
      body: [note, proofUrl ? `مدرک تحویل: ${proofUrl}` : null].filter(Boolean).join('\n'), link: `/orders/${input.orderId}`,
    });
  }
  return r;
}

/** Refund or cancel through server/payments/refund.ts (transactional, idempotent per key, ledger-correct). Amount is toman; empty = everything left. */
export async function refundOrCancel(input: { actorUserId: string; orderId: string; mode: 'REFUND' | 'CANCEL'; amountToman?: unknown; reason: unknown; idempotencyKey: string | null }) {
  await requirePlatformAdmin(input.actorUserId);
  if (input.mode !== 'REFUND' && input.mode !== 'CANCEL') throw new AppError('VALIDATION_ERROR', 'نوع عملیات نامعتبر است.');
  if (!input.idempotencyKey) throw new AppError('VALIDATION_ERROR', 'کلید جلوگیری از تکرار (Idempotency-Key) لازم است.');
  const reason = cleanText(input.reason, 'دلیل', 300, true)!;
  if (Array.from(reason).length < 5) throw new AppError('VALIDATION_ERROR', 'دلیل را کمی کامل‌تر بنویسید.');
  const { workspaceId } = await resolveOrder(input.orderId);
  let amountMinor: bigint | undefined;
  if (input.amountToman !== undefined && input.amountToman !== null && input.amountToman !== '') {
    if (input.mode === 'CANCEL') throw new AppError('VALIDATION_ERROR', 'لغو همیشه کل مبلغ باقی‌مانده را برمی‌گرداند.');
    const t = Number(input.amountToman);
    if (!Number.isSafeInteger(t) || t < 1) throw new AppError('VALIDATION_ERROR', 'مبلغ بازگشت نامعتبر است.');
    const cur = (await withTenantTransaction(workspaceId, input.actorUserId, c => c.query<{ currency: string }>(
      `SELECT currency FROM payments WHERE order_id=$1 AND status IN ('PAID','PARTIALLY_REFUNDED') ORDER BY created_at LIMIT 1`, [input.orderId]))).rows[0]?.currency.trim();
    amountMinor = BigInt(t) * (cur === 'IRR' ? 10n : 1n);
  }
  const out = await refundOrder({ workspaceId, orderId: input.orderId, mode: input.mode, amountMinor, idempotencyKey: input.idempotencyKey, actorUserId: input.actorUserId, reason });
  await withTenantTransaction(workspaceId, input.actorUserId, async c => {
    const seen = await c.query(`SELECT 1 FROM audit_logs WHERE entity_id=$1 AND action IN ('admin.order.refund','admin.order.cancel') AND metadata->>'idempotencyKey'=$2 LIMIT 1`, [input.orderId, input.idempotencyKey]);
    if (seen.rows[0]) return;
    await writeAudit({
      workspaceId, actorUserId: input.actorUserId, action: input.mode === 'CANCEL' ? 'admin.order.cancel' : 'admin.order.refund', entityType: 'order', entityId: input.orderId,
      metadata: { reason, amountToman: input.amountToman ?? null, orderStatus: out.orderStatus, refundId: out.refund?.id ?? null, idempotencyKey: input.idempotencyKey },
    }, c);
  });
  return out;
}
