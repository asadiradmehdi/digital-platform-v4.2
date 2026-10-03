import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { requireUuid, requireString } from '../../../../../server/core/validation';
import { cancelSubscription } from '../../../../../server/subscriptions/service';
import { AppError } from '../../../../../server/core/errors';

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/subscriptions/:id
 * Body: { workspaceId: string; action: 'cancel' }
 *
 * Additional actions (e.g. upgrade/downgrade) can be added here once
 * the server-side service supports them.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const subscriptionId = requireUuid((await params).id, 'subscriptionId');
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    const action = requireString(body.action, 'action');

    if (action !== 'cancel') {
      throw new AppError('VALIDATION_ERROR', `Unsupported action: ${action}. Supported: cancel.`);
    }

    await requireWorkspacePermission(userId, workspaceId, 'subscriptions.cancel');

    const result = await cancelSubscription(subscriptionId, workspaceId);
    return json(result, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
