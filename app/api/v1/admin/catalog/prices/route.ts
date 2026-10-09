import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requirePlatformAdmin } from '../../../../../../server/identity/platform-admin';
import { assertSameOrigin } from '../../../../../../server/core/security-boundary';
import { requireUuid } from '../../../../../../server/core/validation';
import { createDraftPrice } from '../../../../../../server/admin/catalog';

/** Platform admin proposes a new price for a service: stored as an inactive draft until approved. */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const actorUserId = await requireRequestUser(request);
    await requirePlatformAdmin(actorUserId);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const serviceId = requireUuid(body.serviceId, 'serviceId');
    const result = await createDraftPrice({ actorUserId, serviceId, unitToman: body.unitToman, min: body.min, max: body.max });
    return json(result, { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
