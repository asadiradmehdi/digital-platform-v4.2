import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { clientFingerprint } from '../../../../../../../server/core/security-boundary';
import { readBoundedBody } from '../../../../../../../server/core/body';
import { requestOtp, requirePhone } from '../../../../../../../server/identity/otp/service';

/** App: send a sign-in code. No cookie session is involved, so no browser same-origin check applies. */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const ip = clientFingerprint(request);
    const body = await readBoundedBody(request, 2048);
    const phone = requirePhone(body.phone);
    const result = await requestOtp({ phone, purpose: 'LOGIN', ip, client: 'MOBILE', correlationId: id, userAgent: request.headers.get('user-agent') ?? undefined });
    return json({ ok: true, ...result }, { correlationId: id, headers: { 'cache-control': 'no-store' } });
  } catch (error) { return handleRouteError(error, id); }
}
