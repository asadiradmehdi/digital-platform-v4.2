import { query, withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { resetUsagePeriod } from './usage';

export type RenewalResult =
  | { subscriptionId: string; status: 'RENEWED'; newPeriodStart: Date; newPeriodEnd: Date }
  | { subscriptionId: string; status: 'SKIPPED'; reason: string }
  | { subscriptionId: string; status: 'FAILED'; error: string };

/**
 * Advance a single subscription to its next billing period.
 * Idempotent: if the period has already been advanced, returns SKIPPED.
 * Does NOT charge payment — payment must be confirmed before calling this.
 */
export async function advanceSubscriptionPeriod(subscriptionId: string): Promise<RenewalResult> {
  const subRow = await query<{
    id: string;
    workspace_id: string;
    status: string;
    auto_renew: boolean;
    cancel_at_period_end: boolean;
    current_period_end: Date;
    plan_interval: string;
  }>(
    `SELECT s.id, s.workspace_id, s.status, s.auto_renew, s.cancel_at_period_end,
            s.current_period_end, p.billing_interval AS plan_interval
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.id=$1
     FOR UPDATE`,
    [subscriptionId],
  );

  const sub = subRow.rows[0];
  if (!sub) throw new AppError('NOT_FOUND', 'Subscription not found.');

  if (!['ACTIVE', 'TRIALING'].includes(sub.status)) {
    return { subscriptionId, status: 'SKIPPED', reason: `status=${sub.status}` };
  }

  if (!sub.auto_renew) {
    return { subscriptionId, status: 'SKIPPED', reason: 'auto_renew=false' };
  }

  if (sub.cancel_at_period_end) {
    await query(
      `UPDATE subscriptions SET status='CANCELLED', cancelled_at=now(), updated_at=now() WHERE id=$1`,
      [subscriptionId],
    );
    await query(
      `INSERT INTO subscription_events(subscription_id, event_type, payload) VALUES($1,'CANCELLED',$2)`,
      [subscriptionId, { source: 'period_end' }],
    );
    return { subscriptionId, status: 'SKIPPED', reason: 'cancel_at_period_end=true — subscription cancelled' };
  }

  // Check period hasn't already been advanced past current_period_end
  if (new Date(sub.current_period_end) > new Date()) {
    return { subscriptionId, status: 'SKIPPED', reason: 'period has not yet ended' };
  }

  const intervalMs = intervalToMs(sub.plan_interval ?? 'monthly');
  const newPeriodStart = new Date(sub.current_period_end);
  const newPeriodEnd = new Date(newPeriodStart.getTime() + intervalMs);

  await withWorkspaceTransaction(sub.workspace_id, undefined, async client => {
    await client.query(
      `UPDATE subscriptions
       SET status='ACTIVE', current_period_start=$2, current_period_end=$3, updated_at=now()
       WHERE id=$1`,
      [subscriptionId, newPeriodStart, newPeriodEnd],
    );
    await client.query(
      `INSERT INTO subscription_events(subscription_id, event_type, payload) VALUES($1,'RENEWED',$2)`,
      [subscriptionId, { newPeriodStart: newPeriodStart.toISOString(), newPeriodEnd: newPeriodEnd.toISOString() }],
    );
  });

  await resetUsagePeriod({
    subscriptionId,
    workspaceId: sub.workspace_id,
    newPeriodStart,
    newPeriodEnd,
  });

  return { subscriptionId, status: 'RENEWED', newPeriodStart, newPeriodEnd };
}

/**
 * Find all subscriptions due for renewal (period ended, auto_renew=true, active status).
 */
export async function findSubscriptionsDueForRenewal(limit = 50): Promise<string[]> {
  const r = await query<{ id: string }>(
    `SELECT id FROM subscriptions
     WHERE status IN ('ACTIVE', 'TRIALING')
       AND auto_renew = true
       AND cancel_at_period_end = false
       AND current_period_end <= now()
     ORDER BY current_period_end ASC
     LIMIT $1`,
    [limit],
  );
  return r.rows.map(row => row.id);
}

function intervalToMs(interval: string): number {
  switch (interval) {
    case 'weekly': return 7 * 24 * 60 * 60 * 1000;
    case 'monthly': return 30 * 24 * 60 * 60 * 1000;
    case 'quarterly': return 90 * 24 * 60 * 60 * 1000;
    case 'annual': return 365 * 24 * 60 * 60 * 1000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
}
