import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../server/core/db';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../server/core/security-boundary';
import { AppError } from '../../../../server/core/errors';

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

export async function PATCH(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as { displayName?: string; phone?: string };
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 60) : undefined;
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 20) : undefined;
    if (displayName !== undefined && displayName.length < 2) throw new AppError('VALIDATION_ERROR', 'نام نمایشی حداقل ۲ کاراکتر باشد.');
    if (displayName !== undefined) await query(`UPDATE users SET display_name=$1, updated_at=now() WHERE id=$2`, [displayName || null, userId]);
    if (phone !== undefined) await query(`UPDATE users SET phone=$1, updated_at=now() WHERE id=$2`, [phone || null, userId]);
    return json({ ok: true }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
