import { createHash } from 'node:crypto';
import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { requireIdempotencyKey } from '../core/idempotency';
import type { PoolClient } from 'pg';
import { calculateCheckoutTotal, calculateDiscount } from './calculator';
import { assertQuantityWithinBounds } from './quantity';
import { resolvePackageTotal } from '../pricing/package-price';
import { insertSubscription } from '../subscriptions/service';

export type CheckoutItemInput = Readonly<{
  serviceId?: string;
  planId?: string;
  quantity: bigint;
  parameters?: Record<string, unknown>;
}>;

function quoteHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function createCheckout(input: {
  workspaceId: string;
  items: CheckoutItemInput[];
  couponCode?: string;
  idempotencyKey: string;
  expiresInSeconds?: number;
}) {
  requireIdempotencyKey(input.idempotencyKey);
  if (input.items.length === 0) throw new AppError('VALIDATION_ERROR', 'Checkout must contain at least one item.');
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    const existing = await client.query(`SELECT id,status,total_minor,currency,quote_hash FROM checkout_sessions WHERE workspace_id=$1 AND idempotency_key=$2`, [input.workspaceId, input.idempotencyKey]);
    if (existing.rows[0]) return existing.rows[0];

    // A checkout is fulfilled as either one order (services) or one subscription (a plan); a single
    // coupon discount cannot be split across both, so mixing them is refused.
    const planItems = input.items.filter(i => i.planId != null).length;
    if (planItems > 0 && (planItems > 1 || input.items.length > 1)) throw new AppError('VALIDATION_ERROR', 'A plan must be bought in its own checkout.');

    let subtotal = 0n;
    let currency: string | null = null;
    const resolved: Array<Record<string, unknown>> = [];

    for (const item of input.items) {
      if ((item.serviceId == null) === (item.planId == null) || item.quantity <= 0n) throw new AppError('VALIDATION_ERROR', 'Each checkout item must reference exactly one active service or plan and have positive quantity.');
      const row = item.serviceId
        ? await client.query(`SELECT sp.id AS price_id,sp.service_id,sp.unit_price_minor,sp.min_quantity,sp.max_quantity,sp.currency,sp.price_version,sp.pricing_rule_id,sp.fx_rate_id,sp.provider_cost_minor,sp.provider_cost_currency FROM service_prices sp WHERE sp.service_id=$1 AND sp.active=true AND sp.currency='IRT' AND (sp.effective_to IS NULL OR sp.effective_to>now()) ORDER BY sp.effective_from DESC LIMIT 1`, [item.serviceId])
        : await client.query(`SELECT p.id AS plan_id,p.price_minor AS unit_price_minor,p.currency,p.price_version,p.pricing_rule_id,NULL::uuid AS fx_rate_id,NULL::bigint AS provider_cost_minor,NULL::char(3) AS provider_cost_currency FROM plans p WHERE p.id=$1 AND p.active=true`, [item.planId]);
      if (!row.rows[0]) throw new AppError('NOT_FOUND', 'Checkout item is not available.');
      const price = row.rows[0];
      if (item.serviceId) assertQuantityWithinBounds(item.quantity, price.min_quantity, price.max_quantity);
      else if (item.quantity !== 1n) throw new AppError('VALIDATION_ERROR', 'A plan can only be bought once per checkout.');
      const { min_quantity: _min, max_quantity: _max, ...priceRow } = price;
      void _min; void _max;
      if (currency == null) currency = price.currency;
      if (currency !== price.currency) throw new AppError('VALIDATION_ERROR', 'Checkout cannot mix currencies.');
      // A pinned package price replaces quantity × unit; the item keeps the implied unit price, the total stays exact.
      const pkg = item.serviceId ? await resolvePackageTotal(client, item.serviceId, item.quantity, BigInt(price.unit_price_minor)) : null;
      const total = pkg ? pkg.totalMinor : item.quantity * BigInt(price.unit_price_minor);
      subtotal += total;
      resolved.push({ ...priceRow, ...(pkg?.pinned ? { unit_price_minor: pkg.unitMinor.toString() } : {}), quantity: item.quantity.toString(), total: total.toString(), parameters: item.parameters ?? {} });
    }

    let discount = 0n;
    if (input.couponCode) {
      const coupon = await client.query(`SELECT code,discount_type,discount_value,max_discount_minor,minimum_subtotal_minor,max_redemptions,redeemed_count,starts_at,expires_at,active,per_workspace_limit FROM coupons WHERE code=$1 FOR UPDATE`, [input.couponCode]);
      if (!coupon.rows[0]) throw new AppError('NOT_FOUND', 'Coupon not found.');
      const c = coupon.rows[0];
      const now = Date.now();
      if (!c.active || (c.starts_at && new Date(c.starts_at).getTime() > now) || (c.expires_at && new Date(c.expires_at).getTime() <= now)) throw new AppError('CONFLICT', 'Coupon is not active.');
      if (c.max_redemptions != null && BigInt(c.redeemed_count) >= BigInt(c.max_redemptions)) throw new AppError('CONFLICT', 'Coupon redemption limit reached.');
      if (subtotal < BigInt(c.minimum_subtotal_minor)) throw new AppError('CONFLICT', 'Checkout subtotal does not meet coupon minimum.');
      const used = await client.query(`SELECT count(*)::bigint AS count FROM coupon_redemptions WHERE coupon_code=$1 AND workspace_id=$2`, [input.couponCode, input.workspaceId]);
      if (BigInt(used.rows[0].count) >= BigInt(c.per_workspace_limit)) throw new AppError('CONFLICT', 'Coupon usage limit reached for this workspace.');
      discount = calculateDiscount({ subtotalMinor: subtotal, discountType: c.discount_type, discountValue: BigInt(c.discount_value), maxDiscountMinor: c.max_discount_minor == null ? undefined : BigInt(c.max_discount_minor) }).amountMinor;
    }

    const total = calculateCheckoutTotal(subtotal, discount);
    const expiresAt = new Date(Date.now() + Math.max(60, input.expiresInSeconds ?? 900) * 1000);
    const hash = quoteHash({ workspaceId: input.workspaceId, items: resolved, couponCode: input.couponCode ?? null, subtotal: subtotal.toString(), discount: discount.toString(), total: total.toString(), currency });
    const session = await client.query(`INSERT INTO checkout_sessions(workspace_id,status,currency,subtotal_minor,discount_minor,total_minor,coupon_code,quote_hash,expires_at,idempotency_key) VALUES($1,'OPEN',$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,status,total_minor,currency,quote_hash`, [input.workspaceId,currency,subtotal.toString(),discount.toString(),total.toString(),input.couponCode ?? null,hash,expiresAt,input.idempotencyKey]);
    for (const item of resolved) {
      await client.query(`INSERT INTO checkout_items(checkout_session_id,service_id,plan_id,quantity,unit_price_minor,total_minor,currency,price_version,pricing_rule_id,fx_rate_id,provider_cost_minor,provider_cost_currency,parameters) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [session.rows[0].id, item.service_id ?? null, item.plan_id ?? null, item.quantity, item.unit_price_minor, item.total, item.currency, item.price_version ?? null, item.pricing_rule_id ?? null, item.fx_rate_id ?? null, item.provider_cost_minor ?? null, item.provider_cost_currency ?? null, item.parameters]);
    }
    return session.rows[0];
  });
}

type Queryable = Pick<PoolClient, 'query'>;

/**
 * Count a coupon use for a PAID checkout on the caller's tenant transaction. Idempotent per
 * (coupon, workspace): coupon_redemptions has UNIQUE(coupon_code, workspace_id).
 */
export async function redeemCouponForPaidCheckout(client: Queryable, input: { workspaceId: string; couponCode: string; discountMinor: bigint; orderId?: string | null; subscriptionId?: string | null }) {
  if (input.discountMinor === 0n) return { redeemed: false };
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO coupon_redemptions(coupon_code,workspace_id,discount_minor,order_id,subscription_id) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT (coupon_code,workspace_id) DO NOTHING RETURNING id`,
    [input.couponCode, input.workspaceId, input.discountMinor.toString(), input.orderId ?? null, input.subscriptionId ?? null],
  );
  if (!inserted.rows[0]) return { redeemed: false, duplicate: true };
  await client.query(`UPDATE coupons SET redeemed_count=redeemed_count+1 WHERE code=$1`, [input.couponCode]);
  return { redeemed: true };
}

/**
 * Deliver what a gateway-paid checkout bought, on markPaymentPaid's tenant transaction:
 * services become one PAID order (queued for fulfilment through the outbox), a plan becomes a
 * subscription, the coupon is redeemed and the session is marked PAID. Returns fulfilled=false
 * (nothing written) when the session is no longer payable or the paid amount differs from the
 * quote; the caller then keeps the money as wallet balance instead of delivering.
 */
export async function fulfilPaidCheckout(client: Queryable, input: { workspaceId: string; checkoutSessionId: string; paymentId: string; amountMinor: bigint; currency: string }): Promise<{ fulfilled: boolean; reason?: string; orderId?: string; subscriptionId?: string }> {
  const session = await client.query<{ id: string; status: string; currency: string; subtotal_minor: string; discount_minor: string; total_minor: string; coupon_code: string | null }>(
    `SELECT id,status,currency,subtotal_minor::text AS subtotal_minor,discount_minor::text AS discount_minor,total_minor::text AS total_minor,coupon_code
     FROM checkout_sessions WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
    [input.checkoutSessionId, input.workspaceId],
  );
  const s = session.rows[0];
  if (!s) return { fulfilled: false, reason: 'NOT_FOUND' };
  if (!['OPEN', 'PAYMENT_PENDING'].includes(s.status)) return { fulfilled: false, reason: `STATUS_${s.status}` };
  if (BigInt(s.total_minor) !== input.amountMinor || s.currency.trim() !== input.currency.trim()) return { fulfilled: false, reason: 'AMOUNT_MISMATCH' };

  const items = await client.query<{ service_id: string | null; plan_id: string | null; quantity: string; unit_price_minor: string; total_minor: string; currency: string; price_version: string | null; pricing_rule_id: string | null; fx_rate_id: string | null; provider_cost_minor: string | null; provider_cost_currency: string | null; parameters: Record<string, unknown> }>(
    `SELECT service_id,plan_id,quantity::text AS quantity,unit_price_minor::text AS unit_price_minor,total_minor::text AS total_minor,currency,price_version,pricing_rule_id,fx_rate_id,provider_cost_minor::text AS provider_cost_minor,provider_cost_currency,parameters
     FROM checkout_items WHERE checkout_session_id=$1 ORDER BY created_at, id`,
    [input.checkoutSessionId],
  );
  if (items.rows.length === 0) return { fulfilled: false, reason: 'EMPTY' };
  const plan = items.rows.find(i => i.plan_id);
  let orderId: string | undefined;
  let subscriptionId: string | undefined;

  if (plan) {
    if (items.rows.length !== 1) return { fulfilled: false, reason: 'MIXED_ITEMS' };
    const planRow = await client.query<{ id: string; price_minor: string; currency: string; price_version: number | null; pricing_rule_id: string | null }>(
      `SELECT id,price_minor::text AS price_minor,currency,price_version,pricing_rule_id FROM plans WHERE id=$1`,
      [plan.plan_id],
    );
    if (!planRow.rows[0]) return { fulfilled: false, reason: 'PLAN_NOT_FOUND' };
    // The subscription keeps the quoted (pre-discount) list price for renewals.
    const sub = await insertSubscription(client, {
      workspaceId: input.workspaceId,
      plan: { ...planRow.rows[0], price_minor: plan.unit_price_minor, currency: plan.currency.trim() },
      idempotencyKey: `checkout:${input.checkoutSessionId}`,
      source: 'checkout',
    });
    subscriptionId = sub.id;
  } else {
    const order = await client.query<{ id: string }>(
      `INSERT INTO orders(workspace_id,status,currency,subtotal_minor,discount_minor,total_minor,idempotency_key) VALUES($1,'PAID',$2,$3,$4,$5,$6) RETURNING id`,
      [input.workspaceId, s.currency.trim(), s.subtotal_minor, s.discount_minor, s.total_minor, `checkout:${input.checkoutSessionId}`],
    );
    orderId = order.rows[0].id;
    for (const item of items.rows) {
      await client.query(
        `INSERT INTO order_items(order_id,service_id,quantity,unit_price_minor,total_minor,parameters,price_version,pricing_rule_id,fx_rate_id,quoted_at,provider_cost_minor,provider_cost_currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10,$11)`,
        [orderId, item.service_id, item.quantity, item.unit_price_minor, item.total_minor, item.parameters ?? {}, item.price_version, item.pricing_rule_id, item.fx_rate_id, item.provider_cost_minor, item.provider_cost_currency],
      );
    }
    await client.query(`INSERT INTO order_events(order_id,to_status,metadata) VALUES($1,'PAID',$2)`, [orderId, { source: 'checkout', checkoutSessionId: input.checkoutSessionId, paymentId: input.paymentId }]);
    await client.query(`INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,payload) VALUES('order',$1,'order.paid',$2)`, [orderId, { orderId, paymentId: input.paymentId, workspaceId: input.workspaceId }]);
    await client.query(`UPDATE payments SET order_id=$2,updated_at=now() WHERE id=$1`, [input.paymentId, orderId]);
  }

  await client.query(`UPDATE checkout_sessions SET status='PAID',order_id=$2,updated_at=now() WHERE id=$1`, [input.checkoutSessionId, orderId ?? null]);
  if (s.coupon_code) {
    await redeemCouponForPaidCheckout(client, { workspaceId: input.workspaceId, couponCode: s.coupon_code, discountMinor: BigInt(s.discount_minor), orderId, subscriptionId });
  }
  return { fulfilled: true, orderId, subscriptionId };
}
