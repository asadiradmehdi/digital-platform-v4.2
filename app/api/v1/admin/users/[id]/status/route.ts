import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { requireAdminAccess, requirePermission } from '../../../../../../../server/admin/access';
import { assertSameOrigin, clientFingerprint } from '../../../../../../../server/core/security-boundary';
import { requireUuid } from '../../../../../../../server/core/validation';
import { AppError } from '../../../../../../../server/core/errors';
import { setUserStatus } from '../../../../../../../server/admin/users';

type Params = { params: Promise<{ id: string }> };

/** Platform admins suspend or re-activate a customer account; every change is audited. */
export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const targetUserId = requireUuid((await params).id, 'userId');
    const actorUserId = await requireRequestUser(request);
    await requireAdminAccess(actorUserId);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.status !== 'ACTIVE' && body.status !== 'SUSPENDED') throw new AppError('VALIDATION_ERROR', 'وضعیت باید ACTIVE یا SUSPENDED باشد.');
    const reason = typeof body.reason === 'string' ? body.reason : undefined;
    const result = await setUserStatus({ actorUserId, targetUserId, status: body.status, reason, ip: clientFingerprint(request) });
    return json(result, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
