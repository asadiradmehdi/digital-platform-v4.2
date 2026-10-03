import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { requireString } from '../core/validation';

export type WorkspaceUpdateInput = {
  workspaceId: string;
  name?: string;
  settings?: Record<string, unknown>;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown>;
  updatedAt: string;
};

/**
 * Updates workspace name and/or settings.
 * Requires workspace_admin role (enforced at route layer via requireWorkspacePermission).
 */
export async function updateWorkspaceSettings(input: WorkspaceUpdateInput): Promise<WorkspaceSummary> {
  if (input.name !== undefined) {
    requireString(input.name, 'name', 1, 120);
  }
  if (input.settings !== undefined && (typeof input.settings !== 'object' || Array.isArray(input.settings))) {
    throw new AppError('VALIDATION_ERROR', 'settings must be a plain object.');
  }

  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM workspaces WHERE id=$1 AND status != 'ARCHIVED'`,
      [input.workspaceId],
    );
    if (!existing.rows[0]) throw new AppError('NOT_FOUND', 'Workspace not found.');

    const setClauses: string[] = ['updated_at=now()'];
    const params: unknown[] = [input.workspaceId];
    let idx = 2;

    if (input.name !== undefined) {
      setClauses.push(`name=$${idx}`);
      params.push(input.name);
      idx++;
    }
    if (input.settings !== undefined) {
      setClauses.push(`settings=settings || $${idx}::jsonb`);
      params.push(JSON.stringify(input.settings));
      idx++;
    }

    const r = await client.query<WorkspaceSummary>(
      `UPDATE workspaces SET ${setClauses.join(',')}
       WHERE id=$1
       RETURNING id, name, slug, status,
         COALESCE(settings, '{}'::jsonb) AS settings,
         updated_at AS "updatedAt"`,
      params,
    );
    return r.rows[0];
  });
}
