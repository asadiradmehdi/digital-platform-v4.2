import { NextRequest } from 'next/server';
import { query } from '../../../../server/core/db';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { assertSameOrigin } from '../../../../server/core/security-boundary';
import { createWorkspace } from '../../../../server/identity/workspace-settings';
import { AppError } from '../../../../server/core/errors';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const r = await query(
      `SELECT w.id,w.name,w.slug,w.status,wm.status AS "memberStatus"
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id=w.id
       WHERE wm.user_id=$1 AND wm.status='ACTIVE'
       ORDER BY w.created_at DESC`,
      [userId],
    );
    return json({ items: r.rows }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}

/**
 * POST /api/v1/workspaces
 * Create a new workspace owned by the authenticated user.
 * Body: { name: string (required, ≤255 chars), slug?: string }
 */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;

    const name = body.name;
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 255) {
      throw new AppError('VALIDATION_ERROR', 'name is required and must be ≤ 255 characters.');
    }

    const slug = body.slug !== undefined
      ? (typeof body.slug === 'string' ? body.slug.trim() : (() => { throw new AppError('VALIDATION_ERROR', 'slug must be a string.'); })())
      : undefined;

    const workspace = await createWorkspace({ ownerUserId: userId, name: name.trim(), slug });
    return json(workspace, { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
