import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { requirePlatformAdmin } from '../../../../../../../server/identity/platform-admin';
import { assertSameOrigin } from '../../../../../../../server/core/security-boundary';
import { requireUuid } from '../../../../../../../server/core/validation';
import { completeManualOrder } from '../../../../../../../server/commerce/fulfilment';

type Params = { params: Promise<{ id: string }> };

/** Platform operators mark a team-fulfilled order (design, automation, AI content) as delivered. */
export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const orderId = requireUuid((await params).id, 'orderId');
    const userId = await requireRequestUser(request);
    await requirePlatformAdmin(userId);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) || undefined : undefined;
    const result = await completeManualOrder({ orderId, workspaceId, actorUserId: userId, note });
    return json(result, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
