// Shared price-writing primitives of the admin console (no HTTP, no UI). Prices are append-only.
import type { PoolClient } from 'pg';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';

export const PRICE_CURRENCY = 'IRT';
export { MAX_UNIT_PRICE } from '../../lib/admin-packages';

export function wholeNumber(v: unknown, label: string, { min, max, optional }: { min: number; max: number; optional?: boolean }): number | null {
  if ((v === null || v === undefined || v === '') && optional) return null;
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw new AppError('VALIDATION_ERROR', `${label} باید عدد صحیح بین ${min} و ${max} باشد.`);
  return n;
}

/** Inserts `unit` as the new live price (append-only): closes the current row, rejects open drafts, inserts an APPROVED row. */
export async function swapInPrice(client: PoolClient, actorUserId: string, serviceId: string, unit: number, min: number | null, max: number | null, action: string, extra: Record<string, unknown> = {}, batchId?: string) {
  const cur = (await client.query<{ id: string; unit_price_minor: string; price_version: string }>(
    `UPDATE service_prices SET active=false, effective_to=now() WHERE service_id=$1 AND currency=$2 AND active=true RETURNING id, unit_price_minor::text, price_version::text`, [serviceId, PRICE_CURRENCY])).rows[0];
  await client.query(`UPDATE service_prices SET approval_status='REJECTED' WHERE service_id=$1 AND currency=$2 AND approval_status='DRAFT'`, [serviceId, PRICE_CURRENCY]);
  const ins = await client.query<{ id: string }>(
    `INSERT INTO service_prices(service_id, currency, unit_price_minor, min_quantity, max_quantity, active, approval_status, created_by, approved_by, approved_at, price_source, price_version, price_updated_at)
     VALUES($1,$2,$3,$4,$5,true,'APPROVED',$6,$6,now(),'ADMIN',$7,now()) RETURNING id`,
    [serviceId, PRICE_CURRENCY, unit, min, max, actorUserId, Number(cur?.price_version ?? 0) + 1]);
  const id = ins.rows[0].id;
  if (batchId) await client.query(`UPDATE service_prices SET batch_id=$2 WHERE id=$1`, [id, batchId]);
  await writeAudit({ actorUserId, action, entityType: 'service_price', entityId: id,
    metadata: { serviceId, previousPriceId: cur?.id ?? null, fromToman: cur ? Number(cur.unit_price_minor) : null, toToman: unit, ...extra } }, client);
  return id;
}

