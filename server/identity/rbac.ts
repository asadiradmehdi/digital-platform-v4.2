import { AppError } from '../core/errors';
import { query } from '../core/db';

export async function requireWorkspacePermission(userId: string, workspaceId: string, permission: string) {
  const result = await query<{ allowed: boolean }>(`SELECT EXISTS(
    SELECT 1 FROM workspace_members wm
    JOIN member_roles mr ON mr.member_id = wm.id
    JOIN role_permissions rp ON rp.role_id = mr.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE wm.user_id=$1 AND wm.workspace_id=$2 AND wm.status='ACTIVE' AND p.key=$3
  ) AS allowed`, [userId, workspaceId, permission]);
  if (!result.rows[0]?.allowed) throw new AppError('FORBIDDEN', 'Permission denied.');
}
