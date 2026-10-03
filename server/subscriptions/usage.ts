import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { requireIdempotencyKey } from '../core/idempotency';
import { decideUsage } from './policy';

export async function consumeSubscriptionUsage(input: {
  subscriptionId: string;
  workspaceId: string;
  metricKey: string;
  quantity: bigint;
  periodStart: Date;
  periodEnd: Date;
  limitQuantity: bigint | null;
  rolloverQuantity?: bigint;
  idempotencyKey: string;
}) {
  requireIdempotencyKey(input.idempotencyKey);
  if (input.quantity <= 0n) throw new AppError('VALIDATION_ERROR', 'Usage quantity must be positive.');
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    const duplicate = await client.query(`SELECT id FROM usage_events WHERE workspace_id=$1 AND idempotency_key=$2`, [input.workspaceId, input.idempotencyKey]);
    if (duplicate.rows[0]) return { allowed: true, duplicate: true, usageEventId: duplicate.rows[0].id };
    const counter = await client.query(`SELECT id,consumed,limit_quantity,rollover_quantity FROM usage_counters WHERE subscription_id=$1 AND metric_key=$2 AND period_start=$3 FOR UPDATE`, [input.subscriptionId,input.metricKey,input.periodStart]);
    const current = counter.rows[0] ?? { consumed: 0n, limit_quantity: input.limitQuantity, rollover_quantity: input.rolloverQuantity ?? 0n };
    const decision = decideUsage({ consumed: BigInt(current.consumed), requested: input.quantity, limit: current.limit_quantity == null ? null : BigInt(current.limit_quantity), rollover: BigInt(current.rollover_quantity ?? 0) });
    if (!decision.allowed) throw new AppError('CONFLICT', 'Subscription usage limit exceeded.');
    const upsert = await client.query(`INSERT INTO usage_counters(subscription_id,workspace_id,metric_key,period_start,period_end,consumed,limit_quantity,rollover_quantity) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(subscription_id,metric_key,period_start) DO UPDATE SET consumed=usage_counters.consumed+EXCLUDED.consumed,updated_at=now() RETURNING id,consumed`, [input.subscriptionId,input.workspaceId,input.metricKey,input.periodStart,input.periodEnd,input.quantity.toString(),input.limitQuantity == null ? null : input.limitQuantity.toString(),(input.rolloverQuantity ?? 0n).toString()]);
    const event = await client.query(`INSERT INTO usage_events(workspace_id,metric_key,quantity,unit,source_type,source_id,idempotency_key) VALUES($1,$2,$3,'UNIT','SUBSCRIPTION',$4,$5) RETURNING id`, [input.workspaceId,input.metricKey,input.quantity.toString(),input.subscriptionId,input.idempotencyKey]);
    return { allowed: true, duplicate: false, usageEventId: event.rows[0].id, consumed: BigInt(upsert.rows[0].consumed) };
  });
}
