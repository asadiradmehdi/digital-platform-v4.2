import { query, withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { resetUsagePeriod } from './usage';
import { randomUUID } from 'node:crypto';

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
 * Charge the workspace wallet for the subscription renewal price, then advance the period.
 * Returns RENEWED on success, FAILED on insufficient balance, SKIPPED if not due.
 * Idempotent: calling twice for the same period end date is safe (advanceSubscriptionPeriod guards).
 */
export async function processSubscriptionRenewal(subscriptionId: string): Promise<RenewalResult> {
  const subRow = await query<{ id: string; workspace_id: string; status: string; price_minor: string; currency: string; auto_renew: boolean; cancel_at_period_end: boolean; current_period_end: Date }>(
    `SELECT s.id, s.workspace_id, s.status, s.price_minor::text AS price_minor, s.currency,
            s.auto_renew, s.cancel_at_period_end, s.current_period_end
     FROM subscriptions s WHERE s.id=$1 FOR UPDATE`,
    [subscriptionId],
  );
  const sub = subRow.rows[0];
  if (!sub) return { subscriptionId, status: 'FAILED', error: 'Subscription not found.' };
  if (!['ACTIVE', 'TRIALING'].includes(sub.status)) return { subscriptionId, status: 'SKIPPED', reason: `status=${sub.status}` };
  if (new Date(sub.current_period_end) > new Date()) return { subscriptionId, status: 'SKIPPED', reason: 'period has not yet ended' };

  const priceMinor = BigInt(sub.price_minor ?? '0');
  if (priceMinor > 0n) {
    // Debit wallet for renewal charge (idempotent by subscription+period key).
    const chargeKey = `renewal:${subscriptionId}:${sub.current_period_end.toISOString()}`;
    const charged = await withWorkspaceTransaction(sub.workspace_id, undefined, async client => {
      // Lock first, then sum: Postgres forbids FOR UPDATE together with GROUP BY.
      const acct = await client.query<{ account_id: string }>(
        `SELECT la.id AS account_id
         FROM wallets w JOIN ledger_accounts la ON la.wallet_id=w.id
         WHERE w.workspace_id=$1 AND la.account_code='MAIN'
         ORDER BY w.created_at LIMIT 1
         FOR UPDATE OF la`,
        [sub.workspace_id],
      );
      const accountId = acct.rows[0]?.account_id;
      if (!accountId) return false;
      const bal = await client.query<{ balance: string }>(
        `SELECT COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_minor ELSE -amount_minor END),0)::text AS balance
         FROM ledger_entries WHERE account_id=$1`,
        [accountId],
      );
      const balance = BigInt(bal.rows[0]?.balance ?? '0');
      if (balance < priceMinor) return false;
      await client.query(
        `INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,reference_id,idempotency_key,metadata)
         VALUES($1,'DEBIT',$2,$3,'SUBSCRIPTION_RENEWAL',$4,$5,$6)
         ON CONFLICT(account_id,idempotency_key) DO NOTHING`,
        [accountId, priceMinor, sub.currency, subscriptionId, chargeKey, { label: 'تمدید اشتراک' }],
      );
      return true;
    });
    if (!charged) {
      await query(`UPDATE subscriptions SET status='PAST_DUE', updated_at=now() WHERE id=$1 AND status IN ('ACTIVE','TRIALING')`, [subscriptionId]);
      await query(`INSERT INTO subscription_events(subscription_id,event_type,payload) VALUES($1,'PAST_DUE',$2)`, [subscriptionId, { reason: 'insufficient_balance' }]);
      return { subscriptionId, status: 'FAILED', error: 'Insufficient wallet balance for renewal.' };
    }
  }

  return advanceSubscriptionPeriod(subscriptionId);
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
