import { query, withWorkspaceTransaction } from '../core/db';
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

export type CreateWorkspaceInput = {
  ownerUserId: string;
  name: string;
  slug?: string;
};

export type CreatedWorkspace = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
};

/**
 * Creates a new workspace owned by the given user.
 * The user is automatically added as an active member with workspace_admin role.
 */
export async function createWorkspace(input: CreateWorkspaceInput): Promise<CreatedWorkspace> {
  requireString(input.name, 'name', 1, 255);

  // Derive slug from name if not provided: lowercase, replace non-alphanum with hyphens
  const slug =
    input.slug?.trim() ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

  const r = await query<CreatedWorkspace>(
    `WITH new_ws AS (
       INSERT INTO workspaces(owner_user_id, name, slug)
       VALUES ($1, $2, $3)
       RETURNING id, name, slug, status, created_at
     ), admin_role AS (
       SELECT id FROM roles WHERE key='workspace_admin' LIMIT 1
     ), member AS (
       INSERT INTO workspace_members(workspace_id, user_id, status)
       SELECT new_ws.id, $1, 'ACTIVE' FROM new_ws
       RETURNING id
     )
     INSERT INTO member_roles(member_id, role_id)
     SELECT member.id, admin_role.id FROM member, admin_role
     RETURNING (SELECT id FROM new_ws) AS id,
               (SELECT name FROM new_ws) AS name,
               (SELECT slug FROM new_ws) AS slug,
               (SELECT status FROM new_ws) AS status,
               (SELECT created_at FROM new_ws) AS "createdAt"`,
    [input.ownerUserId, input.name, slug],
  );

  if (!r.rows[0]) throw new AppError('INTERNAL_ERROR', 'Failed to create workspace.');
  return r.rows[0];
}

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
