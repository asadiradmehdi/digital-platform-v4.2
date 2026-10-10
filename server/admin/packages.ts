// Package pricing for the admin console. Every listed package of a service (1/3/6/12 months, 1,000 followers…)
// is individually editable: a package either follows quantity × unit price or is PINNED to its own total.
// Editing one package never rewrites another: when the base unit price has to move (the owner edits the
// "base" pack, e.g. the 1-month price), every other package is pinned at the price customers see right now.
// Everything is append-only (rows are closed and re-inserted), recorded as a batch with before/after state so
// it can be undone, and audited. Money: whole toman (IRT minor units), same convention as service_prices.
import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { query, withUserTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { requirePlatformAdmin } from '../identity/platform-admin';
import { bulkNewUnit } from '../../lib/admin-pricing';
import { serviceMeta } from '../../lib/catalog-ui';
import { MAX_UNIT_PRICE, PRICE_CURRENCY, swapInPrice, wholeNumber } from './price-core';
import { MAX_PACKAGE_PRICE, diffStates, marginPct, planPackageEdit, type PackageChange, type PackageEdit, type PriceState } from '../../lib/admin-packages';

export { MAX_PACKAGE_PRICE, planPackageEdit, diffStates, marginPct, suggestPackagePrice, type PriceState, type PackageEdit, type PackageChange, type PackagePlan } from '../../lib/admin-packages';

type Queryable = Pick<PoolClient, 'query'>;
const eff = (q: number, unit: number, pinned: Record<string, number>) => pinned[String(q)] ?? q * unit;

// ── persistence ─────────────────────────────────────────────────────────────────────────────────

type FullState = PriceState & { unitRowId: string | null; min: number | null; max: number | null };

async function readState(client: Queryable, serviceId: string): Promise<FullState> {
  const u = await client.query<{ id: string; unit_price_minor: string; min_quantity: string | null; max_quantity: string | null }>(
    `SELECT id, unit_price_minor::text, min_quantity::text, max_quantity::text FROM service_prices
     WHERE service_id=$1 AND currency=$2 AND active=true AND (effective_to IS NULL OR effective_to > now()) ORDER BY effective_from DESC LIMIT 1`,
    [serviceId, PRICE_CURRENCY]);
  const p = await client.query<{ quantity: string; price_minor: string }>(
    `SELECT quantity::text, price_minor::text FROM service_package_prices
     WHERE service_id=$1 AND active=true AND approval_status='APPROVED' AND currency='IRT'`, [serviceId]);
  const row = u.rows[0];
  const packages: Record<string, number> = {};
  for (const r of p.rows) packages[r.quantity] = Number(r.price_minor);
  return { unit: row ? Number(row.unit_price_minor) : null, unitRowId: row?.id ?? null, min: row?.min_quantity == null ? null : Number(row.min_quantity), max: row?.max_quantity == null ? null : Number(row.max_quantity), packages };
}

const snapshot = (s: PriceState): PriceState => ({ unit: s.unit, packages: { ...s.packages } });

/** Writes `target` over the current state: closes/inserts rows as needed. Returns the batch id, or null when nothing changed. */
async function applyState(client: PoolClient, actorUserId: string, serviceId: string, before: FullState, target: { unit: number | null; packages: Record<string, number> },
  meta: { kind: 'EDIT' | 'BULK' | 'UNDO'; groupId?: string | null; note?: string | null; idempotencyKey?: string | null; action: string }): Promise<string | null> {
  const unitTo = target.unit ?? before.unit;
  const unitChanged = unitTo !== null && unitTo !== before.unit;
  const keys = new Set([...Object.keys(before.packages), ...Object.keys(target.packages)]);
  const diff = [...keys].filter(k => before.packages[k] !== target.packages[k]);
  if (!unitChanged && diff.length === 0) return null;
  if (unitChanged && before.unit === null) throw new AppError('VALIDATION_ERROR', 'این خدمت هنوز قیمت پایه ندارد؛ اول قیمت پایه را ثبت کنید.');

  const after: PriceState = { unit: unitTo, packages: { ...target.packages } };
  const batch = await client.query<{ id: string }>(
    `INSERT INTO service_price_batches(service_id, kind, group_id, before_state, after_state, note, idempotency_key, created_by)
     VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8) RETURNING id`,
    [serviceId, meta.kind, meta.groupId ?? null, JSON.stringify(snapshot(before)), JSON.stringify(after), meta.note ?? null, meta.idempotencyKey ?? null, actorUserId]);
  const batchId = batch.rows[0].id;

  if (unitChanged) await swapInPrice(client, actorUserId, serviceId, unitTo as number, before.min, before.max, `${meta.action}.unit`, { batchId }, batchId);
  for (const k of diff) {
    if (before.packages[k] !== undefined) {
      await client.query(`UPDATE service_package_prices SET active=false, effective_to=now() WHERE service_id=$1 AND quantity=$2 AND active=true`, [serviceId, k]);
    }
    if (target.packages[k] !== undefined) {
      await client.query(
        `INSERT INTO service_package_prices(service_id, quantity, price_minor, active, approval_status, created_by, approved_by, approved_at, batch_id)
         VALUES($1,$2,$3,true,'APPROVED',$4,$4,now(),$5)`, [serviceId, k, target.packages[k], actorUserId, batchId]);
    }
  }
  await writeAudit({ actorUserId, action: meta.action, entityType: 'service', entityId: serviceId, metadata: {
    batchId, kind: meta.kind, groupId: meta.groupId ?? null, unit: unitChanged ? { from: before.unit, to: unitTo } : null,
    packages: diff.map(k => ({ quantity: Number(k), from: before.packages[k] ?? null, to: target.packages[k] ?? null })), note: meta.note ?? null,
  } }, client);
  return batchId;
}

async function lockService(client: PoolClient, serviceId: string): Promise<{ slug: string }> {
  const r = await client.query<{ slug: string }>(`SELECT slug FROM services WHERE id=$1 FOR UPDATE`, [serviceId]);
  if (!r.rows[0]) throw new AppError('NOT_FOUND', 'خدمت پیدا نشد.');
  return r.rows[0];
}

function cleanEdits(raw: unknown, listed: number[]): PackageEdit[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new AppError('VALIDATION_ERROR', 'هیچ تغییری برای ذخیره ارسال نشده است.');
  if (raw.length > 60) throw new AppError('VALIDATION_ERROR', 'تعداد تغییرها بیش از حد مجاز است.');
  const seen = new Set<number>();
  return raw.map(e => {
    const o = (e ?? {}) as Record<string, unknown>;
    const quantity = wholeNumber(o.quantity, 'تعداد بسته', { min: 1, max: 1_000_000_000 })!;
    if (!listed.includes(quantity)) throw new AppError('VALIDATION_ERROR', 'این تعداد جزو بسته‌های نمایش‌داده‌شده به مشتری نیست.');
    if (seen.has(quantity)) throw new AppError('VALIDATION_ERROR', 'یک بسته نباید دو بار ارسال شود.');
    seen.add(quantity);
    const priceToman = o.priceToman === null ? null : wholeNumber(o.priceToman, 'قیمت بسته', { min: 1, max: MAX_PACKAGE_PRICE })!;
    return { quantity, priceToman };
  });
}

/** Read-only plan for the confirmation sheet: what changes, and which packages get pinned because the base price moves. */
export async function previewPackageChanges(input: { actorUserId: string; serviceId: string; edits: unknown }) {
  await requirePlatformAdmin(input.actorUserId);
  const svc = await query<{ slug: string }>(`SELECT slug FROM services WHERE id=$1`, [input.serviceId]);
  if (!svc.rows[0]) throw new AppError('NOT_FOUND', 'خدمت پیدا نشد.');
  const meta = serviceMeta(svc.rows[0].slug);
  const st = await readState({ query: query as never }, input.serviceId);
  if (st.unit === null) throw new AppError('VALIDATION_ERROR', 'این خدمت هنوز قیمت پایه ندارد.');
  const edits = cleanEdits(input.edits, meta.quantities);
  return planPackageEdit({ unit: st.unit, pinned: st.packages, listed: meta.quantities, per: meta.per, edits });
}

/** Saves package edits in one transaction (batch + audit). Replaying the same idempotencyKey returns the first result. */
export async function savePackageChanges(input: { actorUserId: string; serviceId: string; edits: unknown; idempotencyKey?: string | null; note?: string | null }) {
  await requirePlatformAdmin(input.actorUserId);
  const note = (input.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;
  const key = input.idempotencyKey ? String(input.idempotencyKey).slice(0, 80) : null;
  return withUserTransaction(input.actorUserId, async client => {
    const svc = await lockService(client, input.serviceId);
    if (key) {
      const prior = await client.query<{ id: string }>(`SELECT id FROM service_price_batches WHERE service_id=$1 AND idempotency_key=$2`, [input.serviceId, key]);
      if (prior.rows[0]) return { batchId: prior.rows[0].id, changed: false, replayed: true as const, changes: [] as PackageChange[], pinnedBecauseBaseMoved: [] as number[] };
    }
    const meta = serviceMeta(svc.slug);
    const st = await readState(client, input.serviceId);
    if (st.unit === null) throw new AppError('VALIDATION_ERROR', 'این خدمت هنوز قیمت پایه ندارد؛ اول قیمت پایه را ثبت کنید.');
    const edits = cleanEdits(input.edits, meta.quantities);
    const plan = planPackageEdit({ unit: st.unit, pinned: st.packages, listed: meta.quantities, per: meta.per, edits });
    if (!plan.changed) return { batchId: null, changed: false, replayed: false as const, changes: [] as PackageChange[], pinnedBecauseBaseMoved: [] as number[] };
    const batchId = await applyState(client, input.actorUserId, input.serviceId, st, plan.target, { kind: 'EDIT', note, idempotencyKey: key, action: 'admin.package.save' });
    return { batchId, changed: true, replayed: false as const, changes: plan.changes, pinnedBecauseBaseMoved: plan.pinnedBecauseBaseMoved };
  });
}

type BatchRow = { id: string; kind: string; before_state: PriceState; after_state: PriceState; undone_at: string | null; group_id: string | null };

async function undoOn(client: PoolClient, actorUserId: string, serviceId: string, b: BatchRow) {
  const cur = await readState(client, serviceId);
  const restored = await applyState(client, actorUserId, serviceId, cur, { unit: b.before_state.unit, packages: b.before_state.packages ?? {} },
    { kind: 'UNDO', groupId: b.group_id, note: `بازگشت تغییر ${b.id.slice(0, 8)}`, action: 'admin.package.undo' });
  await client.query(`UPDATE service_price_batches SET undone_at=now(), undone_by=$2 WHERE id=$1`, [b.id, actorUserId]);
  return restored !== null;
}

async function latestUndoable(client: Queryable, serviceId: string): Promise<BatchRow | null> {
  const r = await client.query<BatchRow>(
    `SELECT id, kind, before_state, after_state, undone_at::text, group_id::text FROM service_price_batches
     WHERE service_id=$1 AND kind <> 'UNDO' AND undone_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1`, [serviceId]);
  return r.rows[0] ?? null;
}

/** «بازگشت به قبل»: restores the state from before the latest change of this service as a NEW batch (history is kept). */
export async function undoLastPriceChange(input: { actorUserId: string; serviceId: string }) {
  await requirePlatformAdmin(input.actorUserId);
  return withUserTransaction(input.actorUserId, async client => {
    await lockService(client, input.serviceId);
    const b = await latestUndoable(client, input.serviceId);
    if (!b) throw new AppError('VALIDATION_ERROR', 'تغییری برای بازگردانی وجود ندارد.');
    return { batchId: b.id, restored: await undoOn(client, input.actorUserId, input.serviceId, b) };
  });
}

/** Undoes a whole category-wide change: every service whose latest change is still that group's batch. */
export async function undoPriceGroup(input: { actorUserId: string; groupId: string }) {
  await requirePlatformAdmin(input.actorUserId);
  if (!/^[0-9a-f-]{36}$/i.test(input.groupId)) throw new AppError('VALIDATION_ERROR', 'شناسه‌ی تغییر نامعتبر است.');
  return withUserTransaction(input.actorUserId, async client => {
    const rows = await client.query<BatchRow & { service_id: string }>(
      `SELECT id, service_id, kind, before_state, after_state, undone_at::text, group_id::text FROM service_price_batches
       WHERE group_id=$1 AND kind='BULK' AND undone_at IS NULL ORDER BY service_id LIMIT 500`, [input.groupId]);
    let undone = 0; let skipped = 0;
    for (const b of rows.rows) {
      await lockService(client, b.service_id);
      const latest = await latestUndoable(client, b.service_id);
      if (!latest || latest.id !== b.id) { skipped++; continue; }
      await undoOn(client, input.actorUserId, b.service_id, b);
      undone++;
    }
    await writeAudit({ actorUserId: input.actorUserId, action: 'admin.price.bulk_undo', entityType: 'product', metadata: { groupId: input.groupId, undone, skipped } }, client);
    return { undone, skipped };
  });
}

// ── category-wide percent change (preview + apply) ─────────────────────────────────────────────

export type BulkPlanRow = {
  serviceId: string; name: string; oldUnit: number; newUnit: number; per: number; unit: string;
  /** Pinned packages scaled by the same percent. */
  pinned: Array<{ quantity: number; from: number; to: number }>;
};

const roundTotal = (total: number, roundTo: number) => Math.min(MAX_PACKAGE_PRICE, Math.max(1, roundTo > 1 ? Math.round(total / roundTo) * roundTo : Math.round(total)));

async function bulkPlan(client: Queryable, productSlug: string, percent: number, roundTo: number): Promise<BulkPlanRow[]> {
  const r = await client.query<{ id: string; name: string; slug: string; unit_price_minor: string; pinned: Array<{ q: string; p: string }> | null }>(
    `SELECT s.id, s.name, s.slug, sp.unit_price_minor::text,
            COALESCE((SELECT json_agg(json_build_object('q', pp.quantity::text, 'p', pp.price_minor::text) ORDER BY pp.quantity)
                      FROM service_package_prices pp WHERE pp.service_id=s.id AND pp.active=true AND pp.approval_status='APPROVED'), '[]'::json) AS pinned
     FROM services s JOIN products p ON p.id=s.product_id
     JOIN service_prices sp ON sp.service_id=s.id AND sp.active=true AND sp.currency=$2
     WHERE p.slug=$1 ORDER BY s.slug LIMIT 200`, [productSlug, PRICE_CURRENCY]);
  return r.rows.map(x => {
    const kind = serviceMeta(x.slug);
    const old = Number(x.unit_price_minor);
    const pinned = (x.pinned ?? []).map(o => ({ quantity: Number(o.q), from: Number(o.p), to: roundTotal(Number(o.p) * (1 + percent / 100), roundTo) })).filter(o => o.to !== o.from);
    return { serviceId: x.id, name: x.name, oldUnit: old, newUnit: Math.min(MAX_UNIT_PRICE, bulkNewUnit(old, percent, roundTo, kind.per)), per: kind.per, unit: kind.unit, pinned };
  }).filter(x => x.newUnit !== x.oldUnit || x.pinned.length > 0);
}

function bulkArgs(input: { productSlug: unknown; percent: unknown; roundTo?: unknown }) {
  if (typeof input.productSlug !== 'string' || !/^[a-z0-9-]{1,40}$/.test(input.productSlug)) throw new AppError('VALIDATION_ERROR', 'دسته نامعتبر است.');
  const percent = typeof input.percent === 'number' ? input.percent : NaN;
  if (!Number.isFinite(percent) || percent < -90 || percent > 300) throw new AppError('VALIDATION_ERROR', 'درصد تغییر باید بین ۹۰- و ۳۰۰ باشد.');
  const roundTo = input.roundTo === undefined || input.roundTo === null ? 0 : input.roundTo;
  if (roundTo !== 0 && roundTo !== 100 && roundTo !== 1000) throw new AppError('VALIDATION_ERROR', 'گردکردن فقط ۱۰۰ یا ۱۰۰۰ تومان است.');
  return { productSlug: input.productSlug, percent, roundTo: roundTo as number };
}

/** Old→new table for a category-wide percent change (unit prices and pinned packages); nothing is written. */
export async function previewBulk(input: { actorUserId: string; productSlug: unknown; percent: unknown; roundTo?: unknown }) {
  await requirePlatformAdmin(input.actorUserId);
  const a = bulkArgs(input);
  return { rows: await bulkPlan({ query: query as never }, a.productSlug, a.percent, a.roundTo) };
}

/** Applies the same plan in ONE transaction: each changed service gets its own undoable batch; all share a group id. */
export async function applyBulk(input: { actorUserId: string; productSlug: unknown; percent: unknown; roundTo?: unknown }) {
  await requirePlatformAdmin(input.actorUserId);
  const a = bulkArgs(input);
  const groupId = randomUUID();
  return withUserTransaction(input.actorUserId, async client => {
    const plan = await bulkPlan(client, a.productSlug, a.percent, a.roundTo);
    for (const row of plan) {
      await lockService(client, row.serviceId);
      const st = await readState(client, row.serviceId);
      const packages = { ...st.packages };
      for (const o of row.pinned) packages[String(o.quantity)] = o.to;
      await applyState(client, input.actorUserId, row.serviceId, st, { unit: row.newUnit, packages }, { kind: 'BULK', groupId, note: `${a.percent}٪`, action: 'admin.price.bulk_item' });
    }
    await writeAudit({ actorUserId: input.actorUserId, action: 'admin.price.bulk', entityType: 'product', metadata: { productSlug: a.productSlug, percent: a.percent, roundTo: a.roundTo, count: plan.length, groupId } }, client);
    return { count: plan.length, groupId };
  });
}

// ── unit cost (what one unit costs us) ──────────────────────────────────────────────────────────

/** Records what one unit costs ZOHALPAY (toman); null clears it. History rows are kept. */
export async function setUnitCost(input: { actorUserId: string; serviceId: string; unitCostToman: unknown; note?: string | null }) {
  await requirePlatformAdmin(input.actorUserId);
  const cost = wholeNumber(input.unitCostToman, 'هزینه‌ی هر واحد', { min: 0, max: MAX_UNIT_PRICE, optional: true });
  const note = (input.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;
  return withUserTransaction(input.actorUserId, async client => {
    await lockService(client, input.serviceId);
    const cur = (await client.query<{ unit_cost_minor: string }>(`UPDATE service_unit_costs SET active=false, effective_to=now() WHERE service_id=$1 AND active=true RETURNING unit_cost_minor::text`, [input.serviceId])).rows[0];
    if (cost !== null) {
      await client.query(`INSERT INTO service_unit_costs(service_id, unit_cost_minor, note, created_by) VALUES($1,$2,$3,$4)`, [input.serviceId, cost, note, input.actorUserId]);
    }
    await writeAudit({ actorUserId: input.actorUserId, action: 'admin.cost.set', entityType: 'service', entityId: input.serviceId, metadata: { fromToman: cur ? Number(cur.unit_cost_minor) : null, toToman: cost, note } }, client);
    return { unitCostToman: cost };
  });
}

// ── reads ───────────────────────────────────────────────────────────────────────────────────────

export type PackageRow = {
  quantity: number; priceToman: number; computedToman: number; pinned: boolean; perUnitToman: number;
  costToman: number | null; marginPct: number | null; orderable: boolean;
};
export type PriceHistoryItem = {
  id: string; kind: string; at: string; by: string | null; undone: boolean; note: string | null;
  unit: { from: number | null; to: number | null } | null; changes: PackageChange[];
};
export type ServicePackages = {
  service: { id: string; name: string; slug: string; productSlug: string; productName: string; active: boolean; fulfillmentMode: string; description: string | null; hint: string | null; sortOrder: number | null };
  kind: { unit: string; per: number; group: string };
  unitToman: number | null; minQuantity: number | null; maxQuantity: number | null;
  packages: PackageRow[];
  cost: { perUnitToman: number; source: 'manual' | 'provider' } | null;
  history: PriceHistoryItem[];
  undoableBatchId: string | null;
};

export async function getServicePackages(actorUserId: string, serviceId: string): Promise<ServicePackages> {
  await requirePlatformAdmin(actorUserId);
  const s = await query<{ id: string; name: string; slug: string; active: boolean; fulfillment_mode: string; description: string | null; hint: string | null; sort_order: number | null; product_slug: string; product_name: string;
    provider_cost: string | null; provider_cost_currency: string | null; manual_cost: string | null }>(
    `SELECT s.id, s.name, s.slug, s.active, s.fulfillment_mode, s.description, s.hint, s.sort_order, p.slug AS product_slug, p.name AS product_name,
            cur.provider_cost_minor::text AS provider_cost, cur.provider_cost_currency AS provider_cost_currency,
            (SELECT c.unit_cost_minor::text FROM service_unit_costs c WHERE c.service_id=s.id AND c.active ORDER BY c.effective_from DESC LIMIT 1) AS manual_cost
     FROM services s JOIN products p ON p.id=s.product_id
     LEFT JOIN LATERAL (SELECT sp.provider_cost_minor, sp.provider_cost_currency FROM service_prices sp WHERE sp.service_id=s.id AND sp.active=true AND sp.currency=$2 ORDER BY sp.effective_from DESC LIMIT 1) cur ON true
     WHERE s.id=$1`, [serviceId, PRICE_CURRENCY]);
  const row = s.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'خدمت پیدا نشد.');
  const st = await readState({ query: query as never }, serviceId);
  const meta = serviceMeta(row.slug);

  let cost: ServicePackages['cost'] = null;
  if (row.manual_cost !== null) cost = { perUnitToman: Number(row.manual_cost), source: 'manual' };
  else if (row.provider_cost !== null && (row.provider_cost_currency ?? '').trim() === 'IRT') cost = { perUnitToman: Number(row.provider_cost), source: 'provider' };
  else if (row.provider_cost !== null && (row.provider_cost_currency ?? '').trim() === 'IRR') cost = { perUnitToman: Number(row.provider_cost) / 10, source: 'provider' };

  const qtys = [...new Set([...meta.quantities, ...Object.keys(st.packages).map(Number)])].sort((a, b) => a - b);
  const packages: PackageRow[] = st.unit === null ? [] : qtys.map(q => {
    const priceToman = eff(q, st.unit as number, st.packages);
    const pinned = st.packages[String(q)] !== undefined;
    return {
      quantity: q, priceToman, computedToman: q * (st.unit as number), pinned, perUnitToman: Math.round((priceToman / q) * 100) / 100,
      costToman: cost ? Math.round(cost.perUnitToman * q) : null, marginPct: marginPct(priceToman, q, cost?.perUnitToman ?? null),
      orderable: (st.min === null || q >= st.min) && (st.max === null || q <= st.max),
    };
  });

  const hist = await query<{ id: string; kind: string; created_at: string; by_name: string | null; undone_at: string | null; note: string | null; before_state: PriceState; after_state: PriceState }>(
    `SELECT b.id, b.kind, b.created_at::text, u.display_name AS by_name, b.undone_at::text, b.note, b.before_state, b.after_state
     FROM service_price_batches b LEFT JOIN users u ON u.id=b.created_by WHERE b.service_id=$1 ORDER BY b.created_at DESC, b.id DESC LIMIT 15`, [serviceId]);
  const history: PriceHistoryItem[] = hist.rows.map(h => {
    const d = diffStates(h.before_state, h.after_state, qtys);
    return { id: h.id, kind: h.kind, at: h.created_at, by: h.by_name, undone: Boolean(h.undone_at), note: h.note, unit: d.unit, changes: d.changes };
  });
  const undoable = hist.rows.find(h => h.kind !== 'UNDO' && !h.undone_at);

  return {
    service: { id: row.id, name: row.name, slug: row.slug, productSlug: row.product_slug, productName: row.product_name, active: row.active, fulfillmentMode: row.fulfillment_mode, description: row.description, hint: row.hint, sortOrder: row.sort_order },
    kind: { unit: meta.unit, per: meta.per, group: meta.group },
    unitToman: st.unit, minQuantity: st.min, maxQuantity: st.max, packages, cost, history, undoableBatchId: undoable?.id ?? null,
  };
}

export type ServiceMarginRow = { serviceId: string; name: string; slug: string; productSlug: string; worstQuantity: number; worstMarginPct: number; priceToman: number; costToman: number };

/** Services whose lowest listed-package margin is below `thresholdPct` (only where a unit cost is known). */
export async function listLowMargin(actorUserId: string, thresholdPct: number): Promise<{ rows: ServiceMarginRow[]; withCost: number; total: number }> {
  await requirePlatformAdmin(actorUserId);
  const r = await query<{ id: string; name: string; slug: string; product_slug: string; unit: string; manual_cost: string | null; provider_cost: string | null; provider_cost_currency: string | null; pinned: Array<{ q: string; p: string }> }>(
    `SELECT s.id, s.name, s.slug, p.slug AS product_slug, sp.unit_price_minor::text AS unit,
            (SELECT c.unit_cost_minor::text FROM service_unit_costs c WHERE c.service_id=s.id AND c.active LIMIT 1) AS manual_cost,
            sp.provider_cost_minor::text AS provider_cost, sp.provider_cost_currency,
            COALESCE((SELECT json_agg(json_build_object('q', pp.quantity::text, 'p', pp.price_minor::text)) FROM service_package_prices pp
                      WHERE pp.service_id=s.id AND pp.active=true AND pp.approval_status='APPROVED'), '[]'::json) AS pinned
     FROM services s JOIN products p ON p.id=s.product_id
     JOIN service_prices sp ON sp.service_id=s.id AND sp.active=true AND sp.currency=$1
     WHERE s.active=true AND p.active=true`, [PRICE_CURRENCY]);
  const rows: ServiceMarginRow[] = []; let withCost = 0;
  for (const x of r.rows) {
    const cur = (x.provider_cost_currency ?? '').trim();
    const cost = x.manual_cost !== null ? Number(x.manual_cost) : x.provider_cost !== null && cur === 'IRT' ? Number(x.provider_cost) : x.provider_cost !== null && cur === 'IRR' ? Number(x.provider_cost) / 10 : null;
    if (cost === null) continue;
    withCost++;
    const unit = Number(x.unit);
    const pinned: Record<string, number> = Object.fromEntries((x.pinned ?? []).map(o => [o.q, Number(o.p)]));
    let worst: { q: number; m: number; price: number } | null = null;
    for (const q of serviceMeta(x.slug).quantities) {
      const price = eff(q, unit, pinned);
      const m = marginPct(price, q, cost);
      if (m !== null && (worst === null || m < worst.m)) worst = { q, m, price };
    }
    if (worst && worst.m < thresholdPct) rows.push({ serviceId: x.id, name: x.name, slug: x.slug, productSlug: x.product_slug, worstQuantity: worst.q, worstMarginPct: worst.m, priceToman: worst.price, costToman: Math.round(worst.q * cost) });
  }
  rows.sort((a, b) => a.worstMarginPct - b.worstMarginPct);
  return { rows, withCost, total: r.rows.length };
}

export type CatalogSummary = { serviceId: string; pinnedCount: number; minMarginPct: number | null; hasCost: boolean };

/** Per-service flags for the catalogue list: how many packages are pinned, lowest margin. */
export async function getCatalogSummaries(actorUserId: string): Promise<Map<string, CatalogSummary>> {
  await requirePlatformAdmin(actorUserId);
  const r = await query<{ id: string; slug: string; unit: string; manual_cost: string | null; provider_cost: string | null; provider_cost_currency: string | null; pinned: Array<{ q: string; p: string }> }>(
    `SELECT s.id, s.slug, sp.unit_price_minor::text AS unit,
            (SELECT c.unit_cost_minor::text FROM service_unit_costs c WHERE c.service_id=s.id AND c.active LIMIT 1) AS manual_cost,
            sp.provider_cost_minor::text AS provider_cost, sp.provider_cost_currency,
            COALESCE((SELECT json_agg(json_build_object('q', pp.quantity::text, 'p', pp.price_minor::text)) FROM service_package_prices pp
                      WHERE pp.service_id=s.id AND pp.active=true AND pp.approval_status='APPROVED'), '[]'::json) AS pinned
     FROM services s JOIN service_prices sp ON sp.service_id=s.id AND sp.active=true AND sp.currency=$1`, [PRICE_CURRENCY]);
  const out = new Map<string, CatalogSummary>();
  for (const x of r.rows) {
    const cur = (x.provider_cost_currency ?? '').trim();
    const cost = x.manual_cost !== null ? Number(x.manual_cost) : x.provider_cost !== null && cur === 'IRT' ? Number(x.provider_cost) : x.provider_cost !== null && cur === 'IRR' ? Number(x.provider_cost) / 10 : null;
    const pinned: Record<string, number> = Object.fromEntries((x.pinned ?? []).map(o => [o.q, Number(o.p)]));
    let min: number | null = null;
    if (cost !== null) for (const q of serviceMeta(x.slug).quantities) { const m = marginPct(eff(q, Number(x.unit), pinned), q, cost); if (m !== null && (min === null || m < min)) min = m; }
    out.set(x.id, { serviceId: x.id, pinnedCount: Object.keys(pinned).length, minMarginPct: min, hasCost: cost !== null });
  }
  return out;
}
