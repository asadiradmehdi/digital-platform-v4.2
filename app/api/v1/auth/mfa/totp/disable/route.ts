import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { disableTotpMfa } from '../../../../../../../server/identity/mfa-service';
import { requireString } from '../../../../../../../server/core/validation';
import { assertSameOrigin, clientFingerprint } from '../../../../../../../server/core/security-boundary';
import { recordSecurityEvent } from '../../../../../../../server/core/security-events';
import { AppError } from '../../../../../../../server/core/errors';

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const ip = clientFingerprint(request);
    const body = await request.json() as Record<string, unknown>;
    const code = requireString(body.code, 'code', 6, 6);
    const disabled = await disableTotpMfa(userId, code);
    if (!disabled) throw new AppError('VALIDATION_ERROR', 'Invalid TOTP code or MFA not enabled.');
    await recordSecurityEvent({
      eventType: 'MFA_DISABLED',
      severity: 'WARNING',
      userId,
      sourceIp: ip,
      correlationId: id,
      metadata: { method: 'TOTP' },
    });
    return json({ ok: true }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
