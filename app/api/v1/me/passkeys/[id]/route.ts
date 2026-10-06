import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../../server/core/security-boundary';
import { revokePasskey } from '../../../../../../server/identity/passkey-service';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const { id: passkeyId } = await params;
    await revokePasskey(passkeyId, userId);
    return json({ ok: true }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
