import { NextRequest } from 'next/server';
import { correlationId, handleRouteError } from '../../../../../../../server/core/http';
import { clientFingerprint } from '../../../../../../../server/core/security-boundary';
import { readBoundedBody } from '../../../../../../../server/core/body';
import { consumeDistributedRateLimit } from '../../../../../../../server/core/distributed-rate-limit';
import { redeemMobileHandoff } from '../../../../../../../server/identity/google/flow';
import { completeMobileSignIn, readMobileDevice } from '../../../../../../../server/identity/sign-in';

/** App: redeem the deep-link hand-off (with the verifier of the app_challenge it started with) for a session. */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const ip = clientFingerprint(request);
    await consumeDistributedRateLimit({ key: `google-exchange:${ip}`, scope: 'auth.google.exchange.ip', windowSeconds: 60, maxRequests: ip === 'unknown' ? 600 : 10 });
    const body = await readBoundedBody(request, 4096);
    const device = readMobileDevice(body);
    const { userId, created } = await redeemMobileHandoff(body.handoff, body.verifier);
    return await completeMobileSignIn({ userId, method: 'GOOGLE', ip, userAgent: request.headers.get('user-agent') ?? undefined, correlationId: id, created, device });
  } catch (error) { return handleRouteError(error, id); }
}
