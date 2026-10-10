import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { requirePlatformAdmin } from '../../../../../../../server/identity/platform-admin';
import { assertSameOrigin } from '../../../../../../../server/core/security-boundary';
import { requireUuid } from '../../../../../../../server/core/validation';
import { AppError } from '../../../../../../../server/core/errors';
import { revertPrice, setServiceActive } from '../../../../../../../server/admin/catalog';
import { updateServiceDetails } from '../../../../../../../server/admin/catalog-meta';

type Params = { params: Promise<{ id: string }> };

/** Body {active:boolean} shows/hides a service; {action:'revert'} re-inserts the previous price as a new row; {details:{name?,description?,hint?,sortOrder?}} edits what customers read. */
export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const serviceId = requireUuid((await params).id, 'serviceId');
    const actorUserId = await requireRequestUser(request);
    await requirePlatformAdmin(actorUserId);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.details && typeof body.details === 'object') return json(await updateServiceDetails({ actorUserId, serviceId, ...(body.details as Record<string, unknown>) }), { correlationId: id });
    if (body.action === 'revert') return json(await revertPrice({ actorUserId, serviceId }), { correlationId: id });
    if (typeof body.active !== 'boolean') throw new AppError('VALIDATION_ERROR', 'active باید true یا false باشد.');
    return json(await setServiceActive({ actorUserId, serviceId, active: body.active }), { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
