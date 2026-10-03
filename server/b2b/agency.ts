import { query } from '../core/db';
import { AppError } from '../core/errors';

export async function createClientWorkspace(input: {
  agencyWorkspaceId: string;
  ownerUserId: string;
  name: string;
  slug: string;
}): Promise<string> {
  const agency = await query<{ workspace_type: string }>(
    `SELECT workspace_type FROM workspaces WHERE id=$1`,
    [input.agencyWorkspaceId]
  );
  if (!agency.rows[0] || agency.rows[0].workspace_type !== 'agency') {
    throw new AppError('FORBIDDEN', 'Only agency workspaces can create client workspaces.');
  }

  const r = await query<{ id: string }>(
    `INSERT INTO workspaces(owner_user_id, name, slug, workspace_type, parent_workspace_id)
     VALUES($1,$2,$3,'client',$4) RETURNING id`,
    [input.ownerUserId, input.name, input.slug, input.agencyWorkspaceId]
  );
  return r.rows[0]?.id ?? '';
}

export async function listClientWorkspaces(agencyWorkspaceId: string) {
  const r = await query(
    `SELECT id, name, slug, status, workspace_type, created_at
     FROM workspaces WHERE parent_workspace_id=$1 AND workspace_type='client' ORDER BY created_at DESC`,
    [agencyWorkspaceId]
  );
  return r.rows;
}

export async function promoteToAgency(workspaceId: string): Promise<void> {
  await query(
    `UPDATE workspaces SET workspace_type='agency' WHERE id=$1 AND workspace_type='standard'`,
    [workspaceId]
  );
}
