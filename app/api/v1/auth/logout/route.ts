import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { revokeSession, resolveSession } from '../../../../../server/identity/sessions';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { SESSION_COOKIE_NAME, clearSessionCookie } from '../../../../../server/identity/session-cookie';
import { writeAudit } from '../../../../../server/core/audit';

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const userId = await resolveSession(token);
      await revokeSession(token);
      if (userId) {
        await writeAudit({ actorUserId: userId, action: 'LOGOUT', entityType: 'session', entityId: userId });
      }
    }
    const response = json({ ok: true }, { correlationId: id });
    clearSessionCookie(response);
    return response;
  } catch (e) { return handleRouteError(e, id); }
}
