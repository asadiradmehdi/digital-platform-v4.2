import { NextRequest } from 'next/server';
import { query } from '../../../../server/core/db';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const result = await query(`SELECT id,email,display_name AS "displayName",status,created_at AS "createdAt" FROM users WHERE id=$1`, [userId]);
    if (!result.rows[0]) throw new Error('User not found');
    const workspaces = await query(`SELECT w.id,w.name,w.slug,w.status,wm.status AS "memberStatus" FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE wm.user_id=$1 AND wm.status='ACTIVE' ORDER BY w.created_at`, [userId]);
    return json({ user: result.rows[0], workspaces: workspaces.rows }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
