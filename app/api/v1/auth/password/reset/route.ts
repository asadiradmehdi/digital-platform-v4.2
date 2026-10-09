import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { assertSameOrigin, clientFingerprint } from '../../../../../../server/core/security-boundary';
import { readBoundedBody } from '../../../../../../server/core/body';
import { confirmPasswordReset } from '../../../../../../server/identity/password-reset';

/** web: check the SMS code and set the new password; every existing session of the account ends. */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const body = await readBoundedBody(request, 4096);
    await confirmPasswordReset({ challengeId: body.challengeId, code: body.code, newPassword: body.newPassword, ip: clientFingerprint(request), correlationId: id, userAgent: request.headers.get('user-agent') ?? undefined });
    return json({ ok: true }, { correlationId: id, headers: { 'cache-control': 'no-store' } });
  } catch (error) { return handleRouteError(error, id); }
}
