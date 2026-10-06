import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../../server/core/security-boundary';
import { revokeSessionById } from '../../../../../../server/identity/sessions';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const { id: sessionId } = await params;
    await revokeSessionById(sessionId, userId);
    return json({ ok: true }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
