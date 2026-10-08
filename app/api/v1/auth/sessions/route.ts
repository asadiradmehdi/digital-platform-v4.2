import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin, clientFingerprint } from '../../../../../server/core/security-boundary';
import { hashSessionToken, listSignedInDevices, revokeAllOtherSessions } from '../../../../../server/identity/sessions';
import { SESSION_COOKIE_NAME } from '../../../../../server/identity/session-cookie';
import { writeAudit } from '../../../../../server/core/audit';
import { recordSecurityEvent } from '../../../../../server/core/security-events';

/** The caller's own session: the bearer token of the app, or the web session cookie. */
async function currentTokenHash(request: NextRequest) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (bearer) return hashSessionToken(bearer);
  const raw = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return raw ? hashSessionToken(raw) : '';
}

/** Signed-in devices (web and app sessions), current first. */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const items = await listSignedInDevices(userId, await currentTokenHash(request));
    return json({ items }, { correlationId: id, headers: { 'cache-control': 'private, no-store' } });
  } catch (e) { return handleRouteError(e, id); }
}

/** Sign out every other device. */
export async function DELETE(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    await revokeAllOtherSessions(userId, await currentTokenHash(request));
    await recordSecurityEvent({ eventType: 'SESSIONS_REVOKED', severity: 'INFO', userId, sourceIp: clientFingerprint(request), correlationId: id, metadata: { scope: 'others' } });
    await writeAudit({ actorUserId: userId, action: 'SESSIONS_REVOKED', entityType: 'session', entityId: userId, metadata: { scope: 'others' } });
    return json({ ok: true }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
