import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { confirmTotpEnrollment } from '../../../../../../../server/identity/mfa-service';
import { requireString } from '../../../../../../../server/core/validation';
import { assertSameOrigin } from '../../../../../../../server/core/security-boundary';
import { recordSecurityEvent } from '../../../../../../../server/core/security-events';
import { clientFingerprint } from '../../../../../../../server/core/security-boundary';
import { AppError } from '../../../../../../../server/core/errors';

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const ip = clientFingerprint(request);
    const body = await request.json() as Record<string, unknown>;
    const code = requireString(body.code, 'code', 6, 6);
    const recoveryCodes = await confirmTotpEnrollment(userId, code);
    if (!recoveryCodes) throw new AppError('VALIDATION_ERROR', 'Invalid TOTP code or no pending enrollment.');
    await recordSecurityEvent({
      eventType: 'MFA_ENROLLED',
      severity: 'INFO',
      userId,
      sourceIp: ip,
      correlationId: id,
      metadata: { method: 'TOTP' },
    });
    return json({ recoveryCodes }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
