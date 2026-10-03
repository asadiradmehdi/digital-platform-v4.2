import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { getApiUsageSummary, getApiKeyUsage } from '../../../../../server/b2b/usage';
import { AppError } from '../../../../../server/core/errors';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const keyId = searchParams.get('keyId');
    const since = searchParams.get('since');

    if (!workspaceId) throw new AppError('VALIDATION_ERROR', 'workspaceId is required.');
    await requireWorkspacePermission(userId, workspaceId, 'api_keys.read');

    if (keyId) {
      const events = await getApiKeyUsage(keyId, workspaceId);
      return json({ items: events }, { correlationId: id });
    }

    const summary = await getApiUsageSummary(workspaceId, since ? new Date(since) : undefined);
    return json({ items: summary }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
