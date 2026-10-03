import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { getRecoveryCodeStatus, regenerateRecoveryCodes } from '../../../../../server/identity/mfa-service';
import { assertSameOrigin, clientFingerprint } from '../../../../../server/core/security-boundary';
import { recordSecurityEvent } from '../../../../../server/core/security-events';

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
    const userId = await requireRequestUser(request);
    const ip = clientFingerprint(request);
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
