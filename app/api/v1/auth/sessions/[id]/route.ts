import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { assertSameOrigin, clientFingerprint } from '../../../../../../server/core/security-boundary';
import { revokeSessionById } from '../../../../../../server/identity/sessions';
import { AppError } from '../../../../../../server/core/errors';
import { writeAudit } from '../../../../../../server/core/audit';
import { recordSecurityEvent } from '../../../../../../server/core/security-events';

/** Sign out one of the caller's own devices. Someone else's session id reads as not found. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const { id: sessionId } = await params;
    if (!(await revokeSessionById(sessionId, userId))) throw new AppError('NOT_FOUND', 'این نشست پیدا نشد یا پیش‌تر بسته شده است.');
    await recordSecurityEvent({ eventType: 'SESSION_REVOKED', severity: 'INFO', userId, sourceIp: clientFingerprint(request), correlationId: id, metadata: { sessionId } });
    await writeAudit({ actorUserId: userId, action: 'SESSION_REVOKED', entityType: 'session', entityId: sessionId });
    return json({ ok: true }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
