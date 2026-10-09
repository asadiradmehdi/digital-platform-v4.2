import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { assertSameOrigin, clientFingerprint } from '../../../../../../server/core/security-boundary';
import { readBoundedBody } from '../../../../../../server/core/body';
import { requestPasswordReset } from '../../../../../../server/identity/password-reset';

/** web: send a password-reset code to the account's verified mobile. The reply never reveals whether an account matched. */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const body = await readBoundedBody(request, 2048);
    const result = await requestPasswordReset({ identifier: body.identifier, ip: clientFingerprint(request), client: 'WEB', correlationId: id, userAgent: request.headers.get('user-agent') ?? undefined });
    return json({ ok: true, ...result }, { correlationId: id, headers: { 'cache-control': 'no-store' } });
  } catch (error) { return handleRouteError(error, id); }
}
