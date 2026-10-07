import { env } from '../../../../../server/core/config';
import { findSubscriptionsDueForRenewal, processSubscriptionRenewal } from '../../../../../server/subscriptions/renewal';
import { recoverStuckQueuedOrders } from '../../../../../server/providers/health';
import { logger } from '../../../../../server/observability/logger';

function assertCron(request: Request) {
  const expected = env('QUEUE_CRON_SECRET');
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (provided !== expected) throw new Error('Unauthorized');
}

export async function POST(request: Request) {
  try {
    assertCron(request);

    // Process subscription renewals.
    const due = await findSubscriptionsDueForRenewal(50);
    const renewals: Array<{ subscriptionId: string; status: string; error?: string }> = [];
    for (const subscriptionId of due) {
      const result = await processSubscriptionRenewal(subscriptionId);
      const error = 'error' in result ? result.error : undefined;
      renewals.push({ subscriptionId, status: result.status, error });
      if (result.status === 'FAILED') {
        logger.warn('subscription_renewal_failed', {}, { subscriptionId, status: result.status, error });
      }
    }

    // Recover stuck QUEUED orders (no external_order after 15 min).
    const recovered = await recoverStuckQueuedOrders(15, 20);

    return Response.json({ renewals, recovered });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return Response.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
