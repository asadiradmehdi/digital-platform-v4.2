import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { requireAdminAccess, requirePermission } from '../../../../../../../server/admin/access';
import { assertSameOrigin } from '../../../../../../../server/core/security-boundary';
import { requireUuid } from '../../../../../../../server/core/validation';
import { AppError } from '../../../../../../../server/core/errors';
import { setPriceNow } from '../../../../../../../server/admin/catalog';

/** One-tap price change: the new price goes live at once as a new row (history is kept). */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const actorUserId = await requireRequestUser(request);
    await requireAdminAccess(actorUserId);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const serviceId = requireUuid(body.serviceId, 'serviceId');
    return json(await setPriceNow({ actorUserId, serviceId, unitToman: body.unitToman, min: body.min, max: body.max }), { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
