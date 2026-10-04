import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { getRecoveryCodeStatus, regenerateRecoveryCodes } from '../../../../../server/identity/mfa-service';
import { assertSameOrigin, clientFingerprint } from '../../../../../server/core/security-boundary';
import { recordSecurityEvent } from '../../../../../server/core/security-events';
import { consumeDistributedRateLimit } from '../../../../../server/core/distributed-rate-limit';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const status = await getRecoveryCodeStatus(userId);
    return json(status, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const ip = clientFingerprint(request);
    // Rate-limit recovery-code regeneration: max 5 per IP per 15 minutes
    await consumeDistributedRateLimit({ key: `recovery-codes:${ip}`, scope: 'auth.recovery.ip', windowSeconds: 900, maxRequests: 5 });
    const userId = await requireRequestUser(request);
    const codes = await regenerateRecoveryCodes(userId);
    await recordSecurityEvent({
      eventType: 'RECOVERY_CODES_REGENERATED',
      severity: 'INFO',
      userId,
      sourceIp: ip,
      correlationId: id,
    });
    return json({ recoveryCodes: codes }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
