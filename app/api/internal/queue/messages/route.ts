import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../../../../../server/core/config';
import { drainSmsOutbox, processCustomerMessageEvents } from '../../../../../server/notifications/customer-messages';
import { logger } from '../../../../../server/observability/logger';

function authorized(request: Request) {
  const digest = (v: string) => createHash('sha256').update(v).digest();
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  return timingSafeEqual(digest(provided), digest(env('QUEUE_CRON_SECRET')));
}

/** Cron: order/payment events → in-app notifications + queued SMS, then send due SMS (outside requests). */
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const events = await processCustomerMessageEvents(50);
    const sms = await drainSmsOutbox(50);
    return Response.json({ events, sms });
  } catch (err) {
    logger.error('customer messaging run failed', undefined, { error: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: 'Run failed' }, { status: 500 });
  }
}
