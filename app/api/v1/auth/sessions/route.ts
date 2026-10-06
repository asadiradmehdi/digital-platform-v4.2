import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { revokeAllOtherSessions } from '../../../../../server/identity/sessions';
import { SESSION_COOKIE_NAME } from '../../../../../server/identity/session-cookie';

export async function DELETE(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const store = await cookies();
    const cookieName = SESSION_COOKIE_NAME;
    const raw = store.get(cookieName)?.value ?? '';
    const currentHash = raw ? createHash('sha256').update(raw).digest('hex') : '';
    await revokeAllOtherSessions(userId, currentHash);
    return json({ ok: true }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
