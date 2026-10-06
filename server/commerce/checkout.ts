import { createHash } from 'node:crypto';
import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { requireIdempotencyKey } from '../core/idempotency';
import { calculateCheckoutTotal, calculateDiscount } from './calculator';

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

    let subtotal = 0n;
    let currency: string | null = null;
    const resolved: Array<Record<string, unknown>> = [];

    for (const item of input.items) {
      if ((item.serviceId == null) === (item.planId == null) || item.quantity <= 0n) throw new AppError('VALIDATION_ERROR', 'Each checkout item must reference exactly one active service or plan and have positive quantity.');
      const row = item.serviceId
        ? await client.query(`SELECT sp.id AS price_id,sp.service_id,sp.unit_price_minor,sp.currency,sp.price_version,sp.pricing_rule_id,sp.fx_rate_id,sp.provider_cost_minor,sp.provider_cost_currency FROM service_prices sp WHERE sp.service_id=$1 AND sp.active=true AND sp.currency='IRT' AND (sp.effective_to IS NULL OR sp.effective_to>now()) ORDER BY sp.effective_from DESC LIMIT 1`, [item.serviceId])
        : await client.query(`SELECT p.id AS plan_id,p.price_minor AS unit_price_minor,p.currency,p.price_version,p.pricing_rule_id,NULL::uuid AS fx_rate_id,NULL::bigint AS provider_cost_minor,NULL::char(3) AS provider_cost_currency FROM plans p WHERE p.id=$1 AND p.active=true`, [item.planId]);
      if (!row.rows[0]) throw new AppError('NOT_FOUND', 'Checkout item is not available.');
      const price = row.rows[0];
      if (currency == null) currency = price.currency;
      if (currency !== price.currency) throw new AppError('VALIDATION_ERROR', 'Checkout cannot mix currencies.');
      const total = item.quantity * BigInt(price.unit_price_minor);
      subtotal += total;
      resolved.push({ ...price, quantity: item.quantity.toString(), total: total.toString(), parameters: item.parameters ?? {} });
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
    const session = await client.query(`INSERT INTO checkout_sessions(workspace_id,status,currency,subtotal_minor,discount_minor,total_minor,coupon_code,quote_hash,expires_at,idempotency_key) VALUES($1,'OPEN',$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,status,total_minor,currency,quote_hash`, [input.workspaceId,currency,subtotal.toString(),discount.toString(),total.toString(),input.couponCode ?? null,hash,expiresAt,input.idempotencyKey]);
    for (const item of resolved) {
      await client.query(`INSERT INTO checkout_items(checkout_session_id,service_id,plan_id,quantity,unit_price_minor,total_minor,currency,price_version,pricing_rule_id,fx_rate_id,provider_cost_minor,provider_cost_currency,parameters) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [session.rows[0].id, item.service_id ?? null, item.plan_id ?? null, item.quantity, item.unit_price_minor, item.total, item.currency, item.price_version ?? null, item.pricing_rule_id ?? null, item.fx_rate_id ?? null, item.provider_cost_minor ?? null, item.provider_cost_currency ?? null, item.parameters]);
    }
    return session.rows[0];
  });
}

/** Call only after the associated payment is durably marked PAID. */
export async function redeemCheckoutCoupon(input: { checkoutSessionId: string; workspaceId: string }) {
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    const checkout = await client.query(`SELECT coupon_code,discount_minor,status FROM checkout_sessions WHERE id=$1 AND workspace_id=$2 FOR UPDATE`, [input.checkoutSessionId,input.workspaceId]);
    if (!checkout.rows[0]) throw new AppError('NOT_FOUND', 'Checkout session not found.');
    if (!checkout.rows[0].coupon_code || BigInt(checkout.rows[0].discount_minor) === 0n) return { redeemed: false };
    if (checkout.rows[0].status !== 'PAID') throw new AppError('CONFLICT', 'Coupon can only be redeemed after payment.');
    const inserted = await client.query<{id:string}>(
      `INSERT INTO coupon_redemptions(coupon_code,workspace_id,discount_minor) VALUES($1,$2,$3)
       ON CONFLICT (coupon_code,workspace_id) DO NOTHING RETURNING id`,
      [checkout.rows[0].coupon_code,input.workspaceId,checkout.rows[0].discount_minor]
    );
    if (!inserted.rows[0]) return { redeemed: false, duplicate: true };
    await client.query(`UPDATE coupons SET redeemed_count=redeemed_count+1 WHERE code=$1`, [checkout.rows[0].coupon_code]);
    return { redeemed: true };
  });
}
