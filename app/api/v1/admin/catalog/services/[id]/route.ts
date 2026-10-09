import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { requirePlatformAdmin } from '../../../../../../../server/identity/platform-admin';
import { assertSameOrigin } from '../../../../../../../server/core/security-boundary';
import { requireUuid } from '../../../../../../../server/core/validation';
import { AppError } from '../../../../../../../server/core/errors';
import { setServiceActive } from '../../../../../../../server/admin/catalog';

type Params = { params: Promise<{ id: string }> };

/** Body {active:boolean}: show or hide a service in the customer catalogue. */
export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const serviceId = requireUuid((await params).id, 'serviceId');
    const actorUserId = await requireRequestUser(request);
    await requirePlatformAdmin(actorUserId);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (typeof body.active !== 'boolean') throw new AppError('VALIDATION_ERROR', 'active باید true یا false باشد.');
    return json(await setServiceActive({ actorUserId, serviceId, active: body.active }), { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
