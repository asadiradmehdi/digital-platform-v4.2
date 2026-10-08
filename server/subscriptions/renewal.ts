import type { PoolClient } from 'pg';
import { query, withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { resetUsagePeriod } from './usage';
import { lockMainWalletAccount, postWalletEntry, walletBalanceMinor } from '../payments/wallet-ledger';
import { toWalletMinor } from '../payments/currency';
import { issueSubscriptionInvoice } from '../payments/invoice';

export type RenewalResult =
  | { subscriptionId: string; status: 'RENEWED'; newPeriodStart: Date; newPeriodEnd: Date }
  | { subscriptionId: string; status: 'SKIPPED'; reason: string }
  | { subscriptionId: string; status: 'FAILED'; error: string };

type Queryable = Pick<PoolClient, 'query'>;

type LockedSubscription = {
  id: string;
  workspace_id: string;
  status: string;
  auto_renew: boolean;
  cancel_at_period_end: boolean;
  current_period_end: Date;
  plan_interval: string;
  price_minor: string | null;
  currency: string | null;
};

/** Locks the subscription row for the rest of the caller's tenant transaction. */
async function lockSubscription(client: Queryable, subscriptionId: string): Promise<LockedSubscription | undefined> {
  const r = await client.query<LockedSubscription>(
    `SELECT s.id, s.workspace_id, s.status, s.auto_renew, s.cancel_at_period_end,
            s.current_period_end, p.billing_interval AS plan_interval,
            s.price_minor::text AS price_minor, s.currency
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.id=$1
     FOR UPDATE OF s`,
    [subscriptionId],
  );
  return r.rows[0];
}

/** Advances a locked subscription; every write happens on the caller's tenant-transaction client. */
async function advanceLocked(client: Queryable, sub: LockedSubscription): Promise<RenewalResult> {
  const subscriptionId = sub.id;
  if (!['ACTIVE', 'TRIALING'].includes(sub.status)) {
    return { subscriptionId, status: 'SKIPPED', reason: `status=${sub.status}` };
  }

  if (!sub.auto_renew) {
    return { subscriptionId, status: 'SKIPPED', reason: 'auto_renew=false' };
  }

  if (sub.cancel_at_period_end) {
    await client.query(
      `UPDATE subscriptions SET status='CANCELLED', cancelled_at=now(), updated_at=now() WHERE id=$1`,
      [subscriptionId],
    );
    await client.query(
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

  await resetUsagePeriod({
    subscriptionId,
    workspaceId: sub.workspace_id,
    newPeriodStart,
    newPeriodEnd,
  }, client);

  return { subscriptionId, status: 'RENEWED', newPeriodStart, newPeriodEnd };
}

/**
 * Advance a single subscription to its next billing period.
 * Idempotent: if the period has already been advanced, returns SKIPPED.
 * Does NOT charge payment — payment must be confirmed before calling this.
 * subscriptions is RLS-protected, so the whole step (lock, checks, writes, usage reset) runs in one
 * transaction inside the subscription's workspace context.
 */
export async function advanceSubscriptionPeriod(subscriptionId: string, workspaceId: string): Promise<RenewalResult> {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const sub = await lockSubscription(client, subscriptionId);
    if (!sub) throw new AppError('NOT_FOUND', 'Subscription not found.');
    return advanceLocked(client, sub);
  });
}

/**
 * Charge the workspace wallet for the subscription renewal price, then advance the period.
 * Returns RENEWED on success, FAILED on insufficient balance, SKIPPED if not due.
 * The lock, the charge and the period advance commit atomically in the subscription's workspace
 * context, and a subscription that will not renew (auto_renew off, cancel at period end) is never
 * charged. Idempotent: the debit is keyed by subscription + period end, and the locked status/period
 * checks turn a repeated call into SKIPPED.
 */
export async function processSubscriptionRenewal(subscriptionId: string, workspaceId: string): Promise<RenewalResult> {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const sub = await lockSubscription(client, subscriptionId);
    if (!sub) return { subscriptionId, status: 'FAILED', error: 'Subscription not found.' };
    if (!['ACTIVE', 'TRIALING'].includes(sub.status)) return { subscriptionId, status: 'SKIPPED', reason: `status=${sub.status}` };
    if (new Date(sub.current_period_end) > new Date()) return { subscriptionId, status: 'SKIPPED', reason: 'period has not yet ended' };
    if (!sub.auto_renew || sub.cancel_at_period_end) return advanceLocked(client, sub);

    const priceMinor = BigInt(sub.price_minor ?? '0');
    if (priceMinor > 0n) {
      // Debit wallet for renewal charge (idempotent by subscription+period key). Plan prices are kept
      // in the plan currency (IRT) and the wallet in rial (IRR): the balance check and the debit both
      // use the amount converted into the wallet currency, and the entry carries the wallet currency.
      const chargeKey = `renewal:${subscriptionId}:${new Date(sub.current_period_end).toISOString()}`;
      const priceCurrency = String(sub.currency ?? 'IRT').trim();
      const wallet = await lockMainWalletAccount(client, sub.workspace_id);
      let charged = false;
      if (wallet) {
        const needed = toWalletMinor(priceMinor, priceCurrency, wallet.walletCurrency);
        const balance = await walletBalanceMinor(client, wallet.accountId);
        if (balance >= needed) {
          await postWalletEntry(client, wallet, {
            direction: 'DEBIT',
            amountMinor: priceMinor,
            currency: priceCurrency,
            referenceType: 'SUBSCRIPTION_RENEWAL',
            referenceId: subscriptionId,
            idempotencyKey: chargeKey,
            label: 'تمدید اشتراک',
          });
          charged = true;
        }
      }
      if (!charged) {
        await client.query(`UPDATE subscriptions SET status='PAST_DUE', updated_at=now() WHERE id=$1 AND status IN ('ACTIVE','TRIALING')`, [subscriptionId]);
        await client.query(`INSERT INTO subscription_events(subscription_id,event_type,payload) VALUES($1,'PAST_DUE',$2)`, [subscriptionId, { reason: 'insufficient_balance' }]);
        return { subscriptionId, status: 'FAILED', error: 'Insufficient wallet balance for renewal.' };
      }
      // The renewal invoice is issued after the period advanced, so it names the period it pays for.
      const renewed = await advanceLocked(client, sub);
      await issueSubscriptionInvoice(client, {
        workspaceId: sub.workspace_id, subscriptionId, paidMinor: priceMinor, currency: priceCurrency, method: 'WALLET',
        sourceKey: chargeKey, renewal: true,
      });
      return renewed;
    }

    return advanceLocked(client, sub);
  });
}

/**
 * Find all subscriptions due for renewal (period ended, auto_renew=true, active status).
 * This is a cross-tenant scan, so it goes through system_due_subscription_renewals() (migration 0031),
 * which returns only (subscription_id, workspace_id); each renewal then runs in its own workspace.
 */
export async function findSubscriptionsDueForRenewal(limit = 50): Promise<Array<{ subscriptionId: string; workspaceId: string }>> {
  const r = await query<{ subscription_id: string; workspace_id: string }>(
    `SELECT subscription_id, workspace_id FROM system_due_subscription_renewals($1)`,
    [limit],
  );
  return r.rows.map(row => ({ subscriptionId: row.subscription_id, workspaceId: row.workspace_id }));
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
