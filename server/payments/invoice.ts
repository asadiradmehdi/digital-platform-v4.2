// Invoice documents («فاکتورها»). Every successful customer payment issues exactly one document, on
// the SAME tenant transaction that records the payment (callers pass their client), so a payment and
// its document commit or roll back together. Issuing is idempotent by source key:
//   order:<orderId>           sale invoice for a service order (wallet or gateway paid)
//   subscription:<id>         sale invoice for a new subscription
//   renewal:<id>:<periodEnd>  sale invoice for a subscription renewal
//   payment:<paymentId>       «رسید شارژ کیف پول» for money that went into the wallet
// Documents are kept in toman (IRT) only; an IRR amount is converted before it is written.
import type { PoolClient } from 'pg';
import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { categoryMeta, KINDS, serviceKind, targetField } from '../../lib/catalog-ui';
import { formatQuantityWords, orderCode } from '../../lib/format';
import { documentToman, maskTarget, vatPortion } from '../../lib/invoice-format';
import { notifyInvoiceIssued } from './invoice-notify';

type Queryable = Pick<PoolClient, 'query'>;

export type InvoiceType = 'SALE' | 'TOPUP_RECEIPT';
export type InvoicePaymentMethod = 'WALLET' | 'GATEWAY';

export type InvoiceLine = {
  description: string;
  quantity: bigint;
  unitPriceMinor: bigint;
  totalMinor: bigint;
  metadata?: Record<string, unknown>;
};

export type SellerSnapshot = {
  legalName: string; nationalId: string; economicCode: string; address: string; postalCode: string; phone: string;
};

export type InvoiceSettings = { seller: SellerSnapshot; vatEnabled: boolean; vatRateBps: number };

const DOC_CURRENCY = 'IRT';

/** Seller identity and VAT switch (migration 0060). A missing row means the defaults: no VAT, no seller data. */
export async function readInvoiceSettings(client: Queryable): Promise<InvoiceSettings> {
  const r = await client.query<{
    seller_legal_name: string; seller_national_id: string; seller_economic_code: string; seller_address: string;
    seller_postal_code: string; seller_phone: string; vat_enabled: boolean; vat_rate_bps: number;
  }>(`SELECT seller_legal_name,seller_national_id,seller_economic_code,seller_address,seller_postal_code,seller_phone,vat_enabled,vat_rate_bps
      FROM invoice_settings WHERE id=1`);
  const s = r.rows[0];
  return {
    seller: {
      legalName: s?.seller_legal_name ?? '', nationalId: s?.seller_national_id ?? '', economicCode: s?.seller_economic_code ?? '',
      address: s?.seller_address ?? '', postalCode: s?.seller_postal_code ?? '', phone: s?.seller_phone ?? '',
    },
    vatEnabled: Boolean(s?.vat_enabled),
    vatRateBps: Number(s?.vat_rate_bps ?? 1000),
  };
}

/**
 * Write one invoice document on the caller's transaction, exactly once per source key (and per payment
 * / order). A repeated call returns the existing document with created=false and writes nothing.
 * Notifies the buyer in-app (and calls the SMS hook) only when the document is created.
 */
export async function issueInvoice(client: Queryable, input: {
  workspaceId: string;
  type: InvoiceType;
  sourceKey: string;
  title: string;
  lines: InvoiceLine[];
  discountMinor?: bigint;
  orderId?: string | null;
  paymentId?: string | null;
  subscriptionId?: string | null;
  paymentMethod: InvoicePaymentMethod;
  paymentReference?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; invoiceNumber: string; created: boolean }> {
  if (!input.lines.length) throw new AppError('VALIDATION_ERROR', 'An invoice needs at least one line.');
  const existing = await client.query<{ id: string; invoice_number: string }>(
    `SELECT id, invoice_number FROM invoices
     WHERE workspace_id=$1 AND (source_key=$2 OR ($3::uuid IS NOT NULL AND payment_id=$3::uuid) OR ($4::uuid IS NOT NULL AND order_id=$4::uuid))
     ORDER BY created_at LIMIT 1`,
    [input.workspaceId, input.sourceKey, input.paymentId ?? null, input.orderId ?? null],
  );
  if (existing.rows[0]) return { id: existing.rows[0].id, invoiceNumber: existing.rows[0].invoice_number, created: false };

  const subtotal = input.lines.reduce((sum, l) => sum + l.totalMinor, 0n);
  const discount = input.discountMinor ?? 0n;
  const total = subtotal - discount;
  if (discount < 0n || total < 0n) throw new AppError('VALIDATION_ERROR', 'Invoice total cannot be negative.');

  const settings = await readInvoiceSettings(client);
  // Only a sale carries VAT, and only when the platform is registered for it (vat_enabled).
  const vatOn = input.type === 'SALE' && settings.vatEnabled && settings.vatRateBps > 0;
  const vat = vatOn ? vatPortion(total, settings.vatRateBps) : 0n;

  const buyer = await client.query<{ user_id: string; display_name: string | null; phone: string | null; email: string | null }>(
    `SELECT u.id AS user_id, u.display_name, u.phone, u.email
     FROM workspaces w JOIN users u ON u.id=w.owner_user_id WHERE w.id=$1`,
    [input.workspaceId],
  );
  const b = buyer.rows[0];

  const number = await client.query<{ n: string }>(
    `SELECT app_next_invoice_number(EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Tehran'))::int) AS n`,
  );
  const invoiceNumber = number.rows[0]?.n;
  if (!invoiceNumber) throw new Error('Invoice number allocation failed.');

  const inv = await client.query<{ id: string }>(
    `INSERT INTO invoices(workspace_id, invoice_number, document_type, source_key, title, currency, subtotal_minor, discount_minor,
                          total_minor, vat_minor, vat_rate_bps, status, order_id, payment_id, subscription_id, payment_method,
                          payment_reference, buyer_user_id, buyer_name, buyer_phone, buyer_email, seller_snapshot, issued_at, paid_at, metadata)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PAID',$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,now(),now(),$22)
     RETURNING id`,
    [
      input.workspaceId, invoiceNumber, input.type, input.sourceKey, input.title.slice(0, 200), DOC_CURRENCY,
      subtotal.toString(), discount.toString(), total.toString(), vat.toString(), vatOn ? settings.vatRateBps : null,
      input.orderId ?? null, input.paymentId ?? null, input.subscriptionId ?? null, input.paymentMethod,
      input.paymentReference ?? null, b?.user_id ?? null, b?.display_name ?? null, b?.phone ?? null, b?.email ?? null,
      settings.seller, input.metadata ?? {},
    ],
  );
  const invoiceId = inv.rows[0].id;

  for (const [i, line] of input.lines.entries()) {
    await client.query(
      `INSERT INTO invoice_items(invoice_id, line_no, description, quantity, unit_price_minor, total_minor, currency, metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [invoiceId, i + 1, line.description, line.quantity.toString(), line.unitPriceMinor.toString(), line.totalMinor.toString(), DOC_CURRENCY, line.metadata ?? {}],
    );
  }

  await notifyInvoiceIssued(client, {
    workspaceId: input.workspaceId, invoiceId, invoiceNumber, type: input.type, title: input.title, totalToman: total,
    buyerUserId: b?.user_id ?? null, buyerPhone: b?.phone ?? null, href: `/invoices/${invoiceId}`,
  });
  return { id: invoiceId, invoiceNumber, created: true };
}

/** Sale invoice for a paid service order: one line per order item, with masked target and tracking code. */
export async function issueOrderInvoice(client: Queryable, input: {
  workspaceId: string; orderId: string; paymentId?: string | null; method: InvoicePaymentMethod; reference?: string | null;
}) {
  const o = await client.query<{ id: string; currency: string; discount_minor: string }>(
    `SELECT id, currency, discount_minor::text AS discount_minor FROM orders WHERE id=$1 AND workspace_id=$2`,
    [input.orderId, input.workspaceId],
  );
  const order = o.rows[0];
  if (!order) throw new AppError('NOT_FOUND', 'Order not found.');
  const cur = order.currency.trim();
  const items = await client.query<{ quantity: string; unit_price_minor: string; total_minor: string; parameters: Record<string, unknown> | null; name: string; slug: string; product_slug: string }>(
    `SELECT oi.quantity::text AS quantity, oi.unit_price_minor::text AS unit_price_minor, oi.total_minor::text AS total_minor,
            oi.parameters, s.name, s.slug, p.slug AS product_slug
     FROM order_items oi JOIN services s ON s.id=oi.service_id JOIN products p ON p.id=s.product_id
     WHERE oi.order_id=$1 ORDER BY oi.id`,
    [order.id],
  );
  if (!items.rows.length) throw new AppError('CONFLICT', 'Order has no items to invoice.');
  const code = orderCode(order.id);
  const lines: InvoiceLine[] = items.rows.map(it => {
    const q = BigInt(it.quantity);
    const kindKey = serviceKind(it.slug);
    const field = targetField(it.product_slug, kindKey, it.slug);
    const target = maskTarget(it.parameters?.target);
    return {
      description: it.name,
      quantity: q,
      unitPriceMinor: documentToman(BigInt(it.unit_price_minor), cur),
      totalMinor: documentToman(BigInt(it.total_minor), cur),
      metadata: {
        serviceSlug: it.slug,
        category: categoryMeta(it.product_slug)?.name ?? null,
        unit: KINDS[kindKey].unit,
        quantityWords: formatQuantityWords(Number(q)),
        ...(target ? { target, targetLabel: field.label, targetLtr: field.ltr } : {}),
      },
    };
  });
  const first = items.rows[0];
  const q = Number(first.quantity);
  const title = items.rows.length === 1 ? (q > 1 ? `${formatQuantityWords(q)} ${first.name}` : first.name) : `سفارش ${code}`;
  return issueInvoice(client, {
    workspaceId: input.workspaceId,
    type: 'SALE',
    sourceKey: `order:${order.id}`,
    title,
    lines,
    discountMinor: documentToman(BigInt(order.discount_minor), cur),
    orderId: order.id,
    paymentId: input.paymentId ?? null,
    paymentMethod: input.method,
    paymentReference: input.reference ?? null,
    metadata: { orderCode: code },
  });
}

/** «رسید شارژ کیف پول» for a verified gateway payment that was credited to the wallet. */
export async function issueTopupReceipt(client: Queryable, input: {
  workspaceId: string; paymentId: string; amountMinor: bigint; currency: string; reference: string; reason: string;
}) {
  const amount = documentToman(input.amountMinor, input.currency);
  const refund = input.reason !== 'TOPUP';
  return issueInvoice(client, {
    workspaceId: input.workspaceId,
    type: 'TOPUP_RECEIPT',
    sourceKey: `payment:${input.paymentId}`,
    title: 'شارژ کیف پول',
    lines: [{
      description: refund ? 'شارژ کیف پول — مبلغ پرداخت سفارشی که دیگر قابل پرداخت نبود' : 'شارژ کیف پول',
      quantity: 1n, unitPriceMinor: amount, totalMinor: amount,
      metadata: { reason: input.reason },
    }],
    paymentId: input.paymentId,
    paymentMethod: 'GATEWAY',
    paymentReference: input.reference,
  });
}

/**
 * Sale invoice for a subscription period. `paidMinor` is what was actually charged in `currency`;
 * the line carries the subscription's list price and any difference is shown as the discount.
 */
export async function issueSubscriptionInvoice(client: Queryable, input: {
  workspaceId: string; subscriptionId: string; paidMinor: bigint; currency: string; method: InvoicePaymentMethod;
  paymentId?: string | null; reference?: string | null; sourceKey?: string; renewal?: boolean;
}) {
  const s = await client.query<{ plan_name: string; price_minor: string | null; currency: string | null; period_start: Date; period_end: Date }>(
    `SELECT p.name AS plan_name, s.price_minor::text AS price_minor, s.currency, s.current_period_start AS period_start, s.current_period_end AS period_end
     FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.id=$1 AND s.workspace_id=$2`,
    [input.subscriptionId, input.workspaceId],
  );
  const sub = s.rows[0];
  if (!sub) throw new AppError('NOT_FOUND', 'Subscription not found.');
  const paid = documentToman(input.paidMinor, input.currency);
  const listed = sub.price_minor ? documentToman(BigInt(sub.price_minor), String(sub.currency ?? input.currency)) : paid;
  const list = listed > paid ? listed : paid;
  const title = `${input.renewal ? 'تمدید اشتراک' : 'اشتراک'} ${sub.plan_name}`;
  return issueInvoice(client, {
    workspaceId: input.workspaceId,
    type: 'SALE',
    sourceKey: input.sourceKey ?? `subscription:${input.subscriptionId}`,
    title,
    lines: [{
      description: title, quantity: 1n, unitPriceMinor: list, totalMinor: list,
      metadata: { periodStart: sub.period_start, periodEnd: sub.period_end, unit: 'ماه' },
    }],
    discountMinor: list - paid,
    paymentId: input.paymentId ?? null,
    subscriptionId: input.subscriptionId,
    paymentMethod: input.method,
    paymentReference: input.reference ?? null,
  });
}

// ─── reads ──────────────────────────────────────────────────────────────────

export type InvoiceListRow = {
  id: string; invoiceNumber: string; type: InvoiceType; title: string | null; currency: string;
  totalMinor: string; status: string; orderId: string | null; issuedAt: string;
};

/** Newest-first documents of a workspace (RLS: tenant transaction). `limit + 1` rows tell hasMore. */
export async function listInvoices(workspaceId: string, opts: { limit?: number; offset?: number } = {}) {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  const offset = Math.max(0, opts.offset ?? 0);
  const r = await withWorkspaceTransaction(workspaceId, undefined, client => client.query<InvoiceListRow>(
    `SELECT id, invoice_number AS "invoiceNumber", document_type AS type, title, currency, total_minor::text AS "totalMinor",
            status, order_id AS "orderId", COALESCE(issued_at, created_at) AS "issuedAt"
     FROM invoices WHERE workspace_id=$1
     ORDER BY COALESCE(issued_at, created_at) DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [workspaceId, limit + 1, offset],
  ));
  return { items: r.rows.slice(0, limit), hasMore: r.rows.length > limit };
}

export type InvoiceRecord = {
  id: string; invoiceNumber: string; type: InvoiceType; title: string | null; currency: string;
  subtotalMinor: string; discountMinor: string; totalMinor: string; vatMinor: string; vatRateBps: number | null;
  status: string; orderId: string | null; paymentId: string | null; subscriptionId: string | null;
  paymentMethod: InvoicePaymentMethod | null; paymentReference: string | null;
  buyerName: string | null; buyerPhone: string | null; buyerEmail: string | null;
  seller: Partial<SellerSnapshot>; issuedAt: string; paidAt: string | null; metadata: Record<string, unknown>;
  items: Array<{ id: string; description: string; quantity: string; unitPriceMinor: string; totalMinor: string; currency: string; metadata: Record<string, unknown> }>;
};

/** One document with its lines, read inside the workspace (RLS). NOT_FOUND for another tenant's id. */
export async function getInvoice(workspaceId: string, invoiceId: string): Promise<InvoiceRecord> {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const inv = await client.query<Omit<InvoiceRecord, 'items'>>(
      `SELECT id, invoice_number AS "invoiceNumber", document_type AS type, title, currency,
              subtotal_minor::text AS "subtotalMinor", discount_minor::text AS "discountMinor", total_minor::text AS "totalMinor",
              vat_minor::text AS "vatMinor", vat_rate_bps AS "vatRateBps", status, order_id AS "orderId", payment_id AS "paymentId",
              subscription_id AS "subscriptionId", payment_method AS "paymentMethod", payment_reference AS "paymentReference",
              buyer_name AS "buyerName", buyer_phone AS "buyerPhone", buyer_email AS "buyerEmail", seller_snapshot AS seller,
              COALESCE(issued_at, created_at) AS "issuedAt", paid_at AS "paidAt", metadata
       FROM invoices WHERE id=$1 AND workspace_id=$2`,
      [invoiceId, workspaceId],
    );
    if (!inv.rows[0]) throw new AppError('NOT_FOUND', 'Invoice not found.');
    // invoice_items is visible only through an invoice the tenant can see (policy, migration 0060).
    const items = await client.query<InvoiceRecord['items'][number]>(
      `SELECT id, description, quantity::text AS quantity, unit_price_minor::text AS "unitPriceMinor",
              total_minor::text AS "totalMinor", currency, metadata
       FROM invoice_items WHERE invoice_id=$1 ORDER BY line_no, id`,
      [invoiceId],
    );
    return { ...inv.rows[0], items: items.rows };
  });
}

/** The sale invoice of an order, if one was issued (for «مشاهده فاکتور» on the order page). */
export async function findInvoiceIdForOrder(workspaceId: string, orderId: string): Promise<string | null> {
  const r = await withWorkspaceTransaction(workspaceId, undefined, client => client.query<{ id: string }>(
    `SELECT id FROM invoices WHERE workspace_id=$1 AND order_id=$2 LIMIT 1`,
    [workspaceId, orderId],
  ));
  return r.rows[0]?.id ?? null;
}
