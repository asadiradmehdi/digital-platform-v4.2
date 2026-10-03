import { NextRequest } from 'next/server';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { updateWorkspaceSettings } from '../../../../../server/identity/workspace-settings';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { AppError } from '../../../../../server/core/errors';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const cid = correlationId(request);
  try {
    assertSameOrigin(request);
    const { id: workspaceId } = await params;
    const userId = await requireRequestUser(request);
    // workspace_admin permission required to update workspace settings
    await requireWorkspacePermission(userId, workspaceId, 'workspace.settings.manage');
    const body = await request.json() as Record<string, unknown>;

    const name = body.name !== undefined
      ? (typeof body.name === 'string' ? body.name : (() => { throw new AppError('VALIDATION_ERROR', 'name must be a string.'); })())
      : undefined;
    const settings = body.settings !== undefined
      ? (typeof body.settings === 'object' && !Array.isArray(body.settings) && body.settings !== null
          ? body.settings as Record<string, unknown>
          : (() => { throw new AppError('VALIDATION_ERROR', 'settings must be a plain object.'); })())
      : undefined;

    if (name === undefined && settings === undefined) {
      throw new AppError('VALIDATION_ERROR', 'At least one of name or settings must be provided.');
    }

    const updated = await updateWorkspaceSettings({ workspaceId, name, settings });
    return json(updated, { correlationId: cid });
  } catch (e) {
    return handleRouteError(e, cid);
  }
}
