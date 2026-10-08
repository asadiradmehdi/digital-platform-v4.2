// Which workspace a support request acts on: the explicit workspaceId when given, else the user's default
// (first active membership, as the app overview does). The permission check always runs.
import { AppError } from '../core/errors';
import { getViewer } from '../account/overview';
import { requireWorkspacePermission } from '../identity/rbac';

export type SupportPermission = 'workspace.read' | 'support.create';

export async function resolveSupportWorkspace(userId: string, explicit: unknown, permission: SupportPermission): Promise<string | null> {
  let workspaceId: string | null;
  if (explicit != null && explicit !== '') {
    if (typeof explicit !== 'string' || explicit.length > 64) throw new AppError('VALIDATION_ERROR', 'workspaceId is invalid.');
    workspaceId = explicit;
  } else {
    workspaceId = (await getViewer(userId)).workspaceId;
  }
  if (!workspaceId) return null;
  await requireWorkspacePermission(userId, workspaceId, permission);
  return workspaceId;
}

export function noWorkspace(): never {
  throw new AppError('VALIDATION_ERROR', 'برای حساب شما فضای کاری فعالی پیدا نشد. با شماره‌های پشتیبانی تماس بگیرید.');
}
