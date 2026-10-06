import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { requireIdempotencyKey } from '../core/idempotency';

export async function createSubscription(input: { workspaceId:string; planId:string; idempotencyKey:string; startsAt?: Date; trialEndsAt?: Date }) {
  requireIdempotencyKey(input.idempotencyKey);
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    const existing = await client.query<{id:string;status:string}>(`SELECT id,status FROM subscriptions WHERE workspace_id=$1 AND idempotency_key=$2`,[input.workspaceId,input.idempotencyKey]);
    if (existing.rows[0]) return existing.rows[0];
    const plan = await client.query<{id:string;active:boolean;price_minor:string;currency:string;price_generated_at:Date;price_version:number;pricing_rule_id:string|null}>(`SELECT id,active,price_minor,currency,price_generated_at,price_version,pricing_rule_id FROM plans WHERE id=$1`,[input.planId]);
    if (!plan.rows[0] || !plan.rows[0].active) throw new AppError('NOT_FOUND','Plan not found or inactive.');
    const result = await client.query<{id:string;status:string}>(`INSERT INTO subscriptions(workspace_id,plan_id,status,current_period_start,current_period_end,trial_ends_at,idempotency_key,price_minor,currency,price_version,pricing_rule_id) VALUES($1,$2,'TRIALING',COALESCE($3,now()),COALESCE($3,now())+interval '30 days',$4,$5,$6,$7,$8,$9) RETURNING id,status`,[input.workspaceId,input.planId,input.startsAt ?? null,input.trialEndsAt ?? null,input.idempotencyKey,plan.rows[0].price_minor,plan.rows[0].currency,plan.rows[0].price_version,plan.rows[0].pricing_rule_id]);
    await client.query(`INSERT INTO subscription_events(subscription_id,event_type,payload) VALUES($1,'CREATED',$2)`,[result.rows[0].id,{source:'api'}]);
    await client.query(
      `INSERT INTO subscription_entitlement_snapshots(subscription_id,entitlement_key,value)
       SELECT $1, pe.entitlement_key, pe.value FROM plan_entitlements pe WHERE pe.plan_id=$2
       ON CONFLICT(subscription_id,entitlement_key) DO UPDATE SET value=EXCLUDED.value`,
      [result.rows[0].id, input.planId]
    );
    return result.rows[0];
  });
}

export async function cancelSubscription(subscriptionId:string, workspaceId:string) {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    // Lock the row to prevent concurrent cancellations.
    const current = await client.query<{id:string;status:string}>(`SELECT id,status FROM subscriptions WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,[subscriptionId,workspaceId]);
    if (!current.rows[0]) throw new AppError('NOT_FOUND','Subscription not found.');
    // Idempotent: already cancelled is a success, not an error.
    if (current.rows[0].status === 'CANCELLED') return current.rows[0];
    if (current.rows[0].status === 'EXPIRED') throw new AppError('CONFLICT','Cannot cancel an expired subscription.');
    const result = await client.query<{id:string;status:string}>(`UPDATE subscriptions SET status='CANCELLED',cancelled_at=now(),updated_at=now() WHERE id=$1 RETURNING id,status`,[subscriptionId]);
    await client.query(`INSERT INTO subscription_events(subscription_id,event_type,payload) VALUES($1,'CANCELLED',$2)`,[subscriptionId,{source:'api'}]);
    return result.rows[0];
  });
}

type SubscriptionListRow = { id: string; status: string; currentPeriodStart: Date; currentPeriodEnd: Date; trialEndsAt: Date | null; planId: string; planName: string };

export async function listSubscriptions(workspaceId: string): Promise<SubscriptionListRow[]> {
  const result = await withWorkspaceTransaction(workspaceId, undefined, async client => client.query<SubscriptionListRow>(`SELECT s.id,s.status,s.current_period_start AS "currentPeriodStart",s.current_period_end AS "currentPeriodEnd",s.trial_ends_at AS "trialEndsAt",p.id AS "planId",p.name AS "planName" FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.workspace_id=$1 ORDER BY s.created_at DESC`,[workspaceId]));
  return result.rows;
}
