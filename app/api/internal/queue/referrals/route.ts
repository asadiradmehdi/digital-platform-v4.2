import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../../../../../server/core/config';
import { releaseDueReferralRewards } from '../../../../../server/referrals/service';
import { logger } from '../../../../../server/observability/logger';

function authorized(request: Request) {
  const digest = (v: string) => createHash('sha256').update(v).digest();
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  return timingSafeEqual(digest(provided), digest(env('QUEUE_CRON_SECRET')));
}

/** Cron: credit referral shares whose hold period has passed. */
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const released = await releaseDueReferralRewards(100);
    return Response.json({ released });
  } catch (err) {
    logger.error('referral release failed', undefined, { error: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: 'Release failed' }, { status: 500 });
  }
}
