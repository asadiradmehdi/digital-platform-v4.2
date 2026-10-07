import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { beginTotpEnrollment } from '../../../../../../../server/identity/mfa-service';
import { requireString } from '../../../../../../../server/core/validation';
import { assertSameOrigin } from '../../../../../../../server/core/security-boundary';

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;
    const label = requireString(body.label, 'label', 1, 100);
    const { secret } = await beginTotpEnrollment(userId, label);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const issuer = encodeURIComponent('ZOHALPAY');
    const account = encodeURIComponent(label);
    const uri = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    return json({ uri, secret }, { correlationId: id, status: 201 });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
