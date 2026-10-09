// Services & prices for the admin console. Prices are append-only: a new price is a new DRAFT row and
// approving it swaps the active row inside one transaction. Every change is audited with before/after.
import { query, withUserTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { requirePlatformAdmin } from '../identity/platform-admin';
import { bulkNewUnit } from '../../lib/admin-pricing';
import { KINDS, serviceKind } from '../../lib/catalog-ui';
import type { PoolClient } from 'pg';

export const PRICE_CURRENCY = 'IRT';
const MAX_UNIT_PRICE = 100_000_000;

export type AdminServiceRow = {
  id: string; name: string; slug: string; productSlug: string; productName: string; active: boolean; fulfillmentMode: string;
  price: { id: string; unitToman: number; min: number | null; max: number | null; since: string; confirmed: boolean } | null;
  /** The price that was live before the current one (target of «بازگشت به قیمت قبلی»). */
  previous: { unitToman: number; endedAt: string | null } | null;
  draft: { id: string; unitToman: number; min: number | null; max: number | null; createdAt: string } | null;
};

export async function listAdminServices(userId: string): Promise<AdminServiceRow[]> {
  await requirePlatformAdmin(userId);
  const r = await query<{
    id: string; name: string; slug: string; product_slug: string; product_name: string; active: boolean; fulfillment_mode: string;
    p_id: string | null; p_unit: string | null; p_min: string | null; p_max: string | null; p_since: string | null; p_confirmed: boolean | null;
    d_id: string | null; d_unit: string | null; d_min: string | null; d_max: string | null; d_created: string | null;
    v_unit: string | null; v_ended: string | null;
  }>(
    `SELECT s.id, s.name, s.slug, p.slug AS product_slug, p.name AS product_name, s.active, s.fulfillment_mode,
            cur.id AS p_id, cur.unit_price_minor::text AS p_unit, cur.min_quantity::text AS p_min, cur.max_quantity::text AS p_max,
            cur.effective_from::text AS p_since, (cur.approved_at IS NOT NULL) AS p_confirmed,
            dr.id AS d_id, dr.unit_price_minor::text AS d_unit, dr.min_quantity::text AS d_min, dr.max_quantity::text AS d_max, dr.effective_from::text AS d_created,
            pv.unit_price_minor::text AS v_unit, pv.effective_to::text AS v_ended
     FROM services s JOIN products p ON p.id = s.product_id
     LEFT JOIN LATERAL (
       SELECT sp.* FROM service_prices sp WHERE sp.service_id = s.id AND sp.active = true AND sp.currency = $1
         AND (sp.effective_to IS NULL OR sp.effective_to > now()) ORDER BY sp.effective_from DESC LIMIT 1) cur ON true
     LEFT JOIN LATERAL (
       SELECT sp.* FROM service_prices sp WHERE sp.service_id = s.id AND sp.approval_status = 'DRAFT' AND sp.currency = $1
         ORDER BY sp.effective_from DESC LIMIT 1) dr ON true
     LEFT JOIN LATERAL (
       SELECT sp.* FROM service_prices sp WHERE cur.id IS NOT NULL AND sp.service_id = s.id AND sp.currency = $1 AND sp.id <> cur.id
         AND sp.approval_status = 'APPROVED' AND sp.active = false
         ORDER BY sp.effective_to DESC NULLS LAST, sp.effective_from DESC LIMIT 1) pv ON true
     ORDER BY p.slug, s.slug`,
    [PRICE_CURRENCY],
  );
  const n = (v: string | null) => (v == null ? null : Number(v));
  return r.rows.map(x => ({
    id: x.id, name: x.name, slug: x.slug, productSlug: x.product_slug, productName: x.product_name, active: x.active, fulfillmentMode: x.fulfillment_mode,
    price: x.p_id ? { id: x.p_id, unitToman: Number(x.p_unit), min: n(x.p_min), max: n(x.p_max), since: x.p_since!, confirmed: Boolean(x.p_confirmed) } : null,
    previous: x.v_unit ? { unitToman: Number(x.v_unit), endedAt: x.v_ended } : null,
    draft: x.d_id ? { id: x.d_id, unitToman: Number(x.d_unit), min: n(x.d_min), max: n(x.d_max), createdAt: x.d_created! } : null,
  }));
}

function wholeNumber(v: unknown, label: string, { min, max, optional }: { min: number; max: number; optional?: boolean }): number | null {
  if ((v === null || v === undefined || v === '') && optional) return null;
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw new AppError('VALIDATION_ERROR', `${label} باید عدد صحیح بین ${min} و ${max} باشد.`);
  return n;
}

/** Inserts a new inactive DRAFT price (any older open draft of the service is marked REJECTED). */
export async function createDraftPrice(input: { actorUserId: string; serviceId: string; unitToman: unknown; min?: unknown; max?: unknown }) {
  await requirePlatformAdmin(input.actorUserId);
  const unit = wholeNumber(input.unitToman, 'قیمت هر واحد', { min: 1, max: MAX_UNIT_PRICE })!;
  const min = wholeNumber(input.min, 'حداقل تعداد', { min: 1, max: 1_000_000_000, optional: true });
  const max = wholeNumber(input.max, 'حداکثر تعداد', { min: 1, max: 1_000_000_000, optional: true });
  if (min !== null && max !== null && max < min) throw new AppError('VALIDATION_ERROR', 'حداکثر تعداد نباید از حداقل کمتر باشد.');
  return withUserTransaction(input.actorUserId, async client => {
    const svc = await client.query<{ id: string }>(`SELECT id FROM services WHERE id=$1 FOR UPDATE`, [input.serviceId]);
    if (!svc.rows[0]) throw new AppError('NOT_FOUND', 'خدمت پیدا نشد.');
    const cur = await client.query<{ unit_price_minor: string; price_version: string }>(
      `SELECT unit_price_minor::text, price_version::text FROM service_prices
       WHERE service_id=$1 AND currency=$2 AND active=true ORDER BY effective_from DESC LIMIT 1`, [input.serviceId, PRICE_CURRENCY]);
    await client.query(`UPDATE service_prices SET approval_status='REJECTED' WHERE service_id=$1 AND currency=$2 AND approval_status='DRAFT'`, [input.serviceId, PRICE_CURRENCY]);
    const ins = await client.query<{ id: string }>(
      `INSERT INTO service_prices(service_id, currency, unit_price_minor, min_quantity, max_quantity, active, approval_status, created_by, price_source, price_version)
       VALUES($1,$2,$3,$4,$5,false,'DRAFT',$6,'ADMIN',$7) RETURNING id`,
      [input.serviceId, PRICE_CURRENCY, unit, min, max, input.actorUserId, Number(cur.rows[0]?.price_version ?? 0) + 1],
    );
    const id = ins.rows[0].id;
    await writeAudit({ actorUserId: input.actorUserId, action: 'admin.price.draft', entityType: 'service_price', entityId: id,
      metadata: { serviceId: input.serviceId, fromToman: cur.rows[0] ? Number(cur.rows[0].unit_price_minor) : null, toToman: unit, min, max } }, client);
    return { id };
  });
}

type Row = { id: string; service_id: string; currency: string; unit_price_minor: string; approval_status: string; active: boolean; approved_at: string | null };

/** Makes a price row live: closes the active row and activates `p` (a DRAFT), or stamps a seeded unconfirmed price. */
async function approveOn(client: PoolClient, actorUserId: string, p: Row) {
  if (p.approval_status === 'APPROVED' && p.active && !p.approved_at) {
    await client.query(`UPDATE service_prices SET approved_at=now(), approved_by=$2 WHERE id=$1`, [p.id, actorUserId]);
    await writeAudit({ actorUserId, action: 'admin.price.confirm', entityType: 'service_price', entityId: p.id, metadata: { serviceId: p.service_id, toman: Number(p.unit_price_minor) } }, client);
    return { id: p.id, swapped: false };
  }
  if (p.approval_status !== 'DRAFT') throw new AppError('VALIDATION_ERROR', 'فقط پیش‌نویس قیمت قابل تأیید است.');
  const old = (await client.query<{ id: string; unit_price_minor: string }>(
    `UPDATE service_prices SET active=false, effective_to=now() WHERE service_id=$1 AND currency=$2 AND active=true RETURNING id, unit_price_minor::text`, [p.service_id, p.currency])).rows[0];
  await client.query(
    `UPDATE service_prices SET active=true, approval_status='APPROVED', effective_from=now(), approved_at=now(), approved_by=$2, price_updated_at=now() WHERE id=$1`,
    [p.id, actorUserId]);
  await writeAudit({ actorUserId, action: 'admin.price.approve', entityType: 'service_price', entityId: p.id,
    metadata: { serviceId: p.service_id, previousPriceId: old?.id ?? null, fromToman: old ? Number(old.unit_price_minor) : null, toToman: Number(p.unit_price_minor) } }, client);
  return { id: p.id, swapped: true };
}

const ROW_SQL = `SELECT id, service_id, currency, unit_price_minor::text, approval_status, active, approved_at::text FROM service_prices`;

/** Approves a draft (swaps it in as the live price) or confirms a seeded active price the owner has not reviewed. */
export async function approvePrice(input: { actorUserId: string; priceId: string }) {
  await requirePlatformAdmin(input.actorUserId);
  return withUserTransaction(input.actorUserId, async client => {
    const p = (await client.query<Row>(`${ROW_SQL} WHERE id=$1 FOR UPDATE`, [input.priceId])).rows[0];
    if (!p) throw new AppError('NOT_FOUND', 'قیمت پیدا نشد.');
    return approveOn(client, input.actorUserId, p);
  });
}

/** Approves every open draft (optionally only one category) in a single transaction. */
export async function approveAllDrafts(input: { actorUserId: string; productSlug?: string | null }) {
  await requirePlatformAdmin(input.actorUserId);
  return withUserTransaction(input.actorUserId, async client => {
    const drafts = (await client.query<Row>(
      `SELECT sp.id, sp.service_id, sp.currency, sp.unit_price_minor::text, sp.approval_status, sp.active, sp.approved_at::text
       FROM service_prices sp JOIN services s ON s.id=sp.service_id JOIN products p ON p.id=s.product_id
       WHERE sp.approval_status='DRAFT' AND sp.currency=$1 AND ($2::text IS NULL OR p.slug=$2) ORDER BY sp.id LIMIT 500 FOR UPDATE OF sp`,
      [PRICE_CURRENCY, input.productSlug ?? null])).rows;
    for (const d of drafts) await approveOn(client, input.actorUserId, d);
    await writeAudit({ actorUserId: input.actorUserId, action: 'admin.price.approve_all', entityType: 'service_price', metadata: { productSlug: input.productSlug ?? null, count: drafts.length } }, client);
    return { count: drafts.length };
  });
}

/** Inserts `unit` as the new live price (append-only): closes the current row, rejects open drafts, inserts an APPROVED row. */
async function swapInPrice(client: PoolClient, actorUserId: string, serviceId: string, unit: number, min: number | null, max: number | null, action: string, extra: Record<string, unknown> = {}) {
  const cur = (await client.query<{ id: string; unit_price_minor: string; price_version: string }>(
    `UPDATE service_prices SET active=false, effective_to=now() WHERE service_id=$1 AND currency=$2 AND active=true RETURNING id, unit_price_minor::text, price_version::text`, [serviceId, PRICE_CURRENCY])).rows[0];
  await client.query(`UPDATE service_prices SET approval_status='REJECTED' WHERE service_id=$1 AND currency=$2 AND approval_status='DRAFT'`, [serviceId, PRICE_CURRENCY]);
  const ins = await client.query<{ id: string }>(
    `INSERT INTO service_prices(service_id, currency, unit_price_minor, min_quantity, max_quantity, active, approval_status, created_by, approved_by, approved_at, price_source, price_version, price_updated_at)
     VALUES($1,$2,$3,$4,$5,true,'APPROVED',$6,$6,now(),'ADMIN',$7,now()) RETURNING id`,
    [serviceId, PRICE_CURRENCY, unit, min, max, actorUserId, Number(cur?.price_version ?? 0) + 1]);
  const id = ins.rows[0].id;
  await writeAudit({ actorUserId, action, entityType: 'service_price', entityId: id,
    metadata: { serviceId, previousPriceId: cur?.id ?? null, fromToman: cur ? Number(cur.unit_price_minor) : null, toToman: unit, ...extra } }, client);
  return id;
}

/** One-tap price change: the new price goes live immediately as a new row; the old row is kept as history. */
export async function setPriceNow(input: { actorUserId: string; serviceId: string; unitToman: unknown; min?: unknown; max?: unknown }) {
  await requirePlatformAdmin(input.actorUserId);
  const unit = wholeNumber(input.unitToman, 'قیمت هر واحد', { min: 1, max: MAX_UNIT_PRICE })!;
  const min = wholeNumber(input.min, 'حداقل تعداد', { min: 1, max: 1_000_000_000, optional: true });
  const max = wholeNumber(input.max, 'حداکثر تعداد', { min: 1, max: 1_000_000_000, optional: true });
  if (min !== null && max !== null && max < min) throw new AppError('VALIDATION_ERROR', 'حداکثر تعداد نباید از حداقل کمتر باشد.');
  return withUserTransaction(input.actorUserId, async client => {
    if (!(await client.query(`SELECT id FROM services WHERE id=$1 FOR UPDATE`, [input.serviceId])).rows[0]) throw new AppError('NOT_FOUND', 'خدمت پیدا نشد.');
    const cur = (await client.query<{ unit_price_minor: string }>(`SELECT unit_price_minor::text FROM service_prices WHERE service_id=$1 AND currency=$2 AND active=true`, [input.serviceId, PRICE_CURRENCY])).rows[0];
    if (cur && Number(cur.unit_price_minor) === unit) throw new AppError('VALIDATION_ERROR', 'این همان قیمت فعلی است.');
    return { id: await swapInPrice(client, input.actorUserId, input.serviceId, unit, min, max, 'admin.price.set') };
  });
}

/** «بازگشت به قیمت قبلی»: re-inserts the previously live price as a NEW row; history is never edited. */
export async function revertPrice(input: { actorUserId: string; serviceId: string }) {
  await requirePlatformAdmin(input.actorUserId);
  return withUserTransaction(input.actorUserId, async client => {
    if (!(await client.query(`SELECT id FROM services WHERE id=$1 FOR UPDATE`, [input.serviceId])).rows[0]) throw new AppError('NOT_FOUND', 'خدمت پیدا نشد.');
    const cur = (await client.query<{ id: string }>(`SELECT id FROM service_prices WHERE service_id=$1 AND currency=$2 AND active=true`, [input.serviceId, PRICE_CURRENCY])).rows[0];
    const prev = cur ? (await client.query<{ id: string; unit_price_minor: string; min_quantity: string | null; max_quantity: string | null }>(
      `SELECT id, unit_price_minor::text, min_quantity::text, max_quantity::text FROM service_prices
       WHERE service_id=$1 AND currency=$2 AND id<>$3 AND approval_status='APPROVED' AND active=false
       ORDER BY effective_to DESC NULLS LAST, effective_from DESC LIMIT 1`, [input.serviceId, PRICE_CURRENCY, cur.id])).rows[0] : undefined;
    if (!prev) throw new AppError('VALIDATION_ERROR', 'قیمت قبلی‌ای برای بازگشت وجود ندارد.');
    const id = await swapInPrice(client, input.actorUserId, input.serviceId, Number(prev.unit_price_minor),
      prev.min_quantity == null ? null : Number(prev.min_quantity), prev.max_quantity == null ? null : Number(prev.max_quantity), 'admin.price.revert', { revertedToPriceId: prev.id });
    return { id, unitToman: Number(prev.unit_price_minor) };
  });
}

export type BulkPlanRow = { serviceId: string; name: string; oldUnit: number; newUnit: number; per: number; unit: string };

async function bulkPlan(client: { query: PoolClient['query'] }, productSlug: string, percent: number, roundTo: number): Promise<BulkPlanRow[]> {
  const r = await client.query<{ id: string; name: string; slug: string; unit_price_minor: string }>(
    `SELECT s.id, s.name, s.slug, sp.unit_price_minor::text FROM services s JOIN products p ON p.id=s.product_id
     JOIN service_prices sp ON sp.service_id=s.id AND sp.active=true AND sp.currency=$2
     WHERE p.slug=$1 ORDER BY s.slug LIMIT 200`, [productSlug, PRICE_CURRENCY]);
  return r.rows.map(x => {
    const kind = KINDS[serviceKind(x.slug)];
    const old = Number(x.unit_price_minor);
    return { serviceId: x.id, name: x.name, oldUnit: old, newUnit: Math.min(MAX_UNIT_PRICE, bulkNewUnit(old, percent, roundTo, kind.per)), per: kind.per, unit: kind.unit };
  }).filter(x => x.newUnit !== x.oldUnit);
}

function bulkArgs(input: { productSlug: unknown; percent: unknown; roundTo?: unknown }) {
  if (typeof input.productSlug !== 'string' || !/^[a-z0-9-]{1,40}$/.test(input.productSlug)) throw new AppError('VALIDATION_ERROR', 'دسته نامعتبر است.');
  const percent = typeof input.percent === 'number' ? input.percent : NaN;
  if (!Number.isFinite(percent) || percent < -90 || percent > 300) throw new AppError('VALIDATION_ERROR', 'درصد تغییر باید بین ۹۰- و ۳۰۰ باشد.');
  const roundTo = input.roundTo === undefined || input.roundTo === null ? 0 : input.roundTo;
  if (roundTo !== 0 && roundTo !== 100 && roundTo !== 1000) throw new AppError('VALIDATION_ERROR', 'گردکردن فقط ۱۰۰ یا ۱۰۰۰ تومان است.');
  return { productSlug: input.productSlug, percent, roundTo: roundTo as number };
}

/** Old→new table for a category-wide percent change; nothing is written. */
export async function previewBulk(input: { actorUserId: string; productSlug: unknown; percent: unknown; roundTo?: unknown }) {
  await requirePlatformAdmin(input.actorUserId);
  const a = bulkArgs(input);
  return { rows: await bulkPlan({ query: query as never }, a.productSlug, a.percent, a.roundTo) };
}

/** Applies the same plan in ONE transaction: every changed service gets a new live row (open drafts are rejected). */
export async function applyBulk(input: { actorUserId: string; productSlug: unknown; percent: unknown; roundTo?: unknown }) {
  await requirePlatformAdmin(input.actorUserId);
  const a = bulkArgs(input);
  return withUserTransaction(input.actorUserId, async client => {
    const plan = await bulkPlan(client, a.productSlug, a.percent, a.roundTo);
    for (const row of plan) {
      await client.query(`SELECT id FROM services WHERE id=$1 FOR UPDATE`, [row.serviceId]);
      const q = (await client.query<{ min_quantity: string | null; max_quantity: string | null }>(`SELECT min_quantity::text, max_quantity::text FROM service_prices WHERE service_id=$1 AND currency=$2 AND active=true`, [row.serviceId, PRICE_CURRENCY])).rows[0];
      await swapInPrice(client, input.actorUserId, row.serviceId, row.newUnit, q?.min_quantity == null ? null : Number(q.min_quantity), q?.max_quantity == null ? null : Number(q.max_quantity), 'admin.price.bulk_item', { percent: a.percent, roundTo: a.roundTo });
    }
    await writeAudit({ actorUserId: input.actorUserId, action: 'admin.price.bulk', entityType: 'product', metadata: { productSlug: a.productSlug, percent: a.percent, roundTo: a.roundTo, count: plan.length } }, client);
    return { count: plan.length };
  });
}

export async function rejectPrice(input: { actorUserId: string; priceId: string }) {
  await requirePlatformAdmin(input.actorUserId);
  return withUserTransaction(input.actorUserId, async client => {
    const r = await client.query<{ service_id: string }>(
      `UPDATE service_prices SET approval_status='REJECTED' WHERE id=$1 AND approval_status='DRAFT' RETURNING service_id`, [input.priceId]);
    if (!r.rows[0]) throw new AppError('NOT_FOUND', 'پیش‌نویس قیمت پیدا نشد.');
    await writeAudit({ actorUserId: input.actorUserId, action: 'admin.price.reject', entityType: 'service_price', entityId: input.priceId, metadata: { serviceId: r.rows[0].service_id } }, client);
    return { id: input.priceId };
  });
}

/** Shows or hides one service in the customer catalogue (services.active). */
export async function setServiceActive(input: { actorUserId: string; serviceId: string; active: boolean }) {
  await requirePlatformAdmin(input.actorUserId);
  if (typeof input.active !== 'boolean') throw new AppError('VALIDATION_ERROR', 'وضعیت نامعتبر است.');
  return withUserTransaction(input.actorUserId, async client => {
    const r = await client.query<{ was: boolean }>(
      `UPDATE services s SET active=$2 FROM (SELECT id, active FROM services WHERE id=$1 FOR UPDATE) o WHERE s.id=o.id RETURNING o.active AS was`, [input.serviceId, input.active]);
    if (!r.rows[0]) throw new AppError('NOT_FOUND', 'خدمت پیدا نشد.');
    if (r.rows[0].was !== input.active) {
      await writeAudit({ actorUserId: input.actorUserId, action: input.active ? 'admin.service.enable' : 'admin.service.disable', entityType: 'service', entityId: input.serviceId, metadata: { from: r.rows[0].was, to: input.active } }, client);
    }
    return { active: input.active };
  });
}
