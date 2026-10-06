import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { query } from '../../../../../server/core/db';
import { AppError } from '../../../../../server/core/errors';

export async function POST(req: NextRequest) {
  try { assertSameOrigin(req); } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  }

  const userId = await requireRequestUser(req);
  if (!userId) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json() as {
    workspaceId?: string; subject?: string; category?: string; priority?: string; message?: string;
  };

  const workspaceId = body.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'workspaceId required' } }, { status: 400 });

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  if (!subject) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'subject required' } }, { status: 400 });
  if (subject.length > 160) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'subject too long' } }, { status: 400 });

  try {
    await requireWorkspacePermission(userId, workspaceId, 'workspace.read');
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  }

  const priority = (['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).includes(body.priority?.toUpperCase() as never)
    ? body.priority!.toUpperCase()
    : 'NORMAL';

  const result = await query<{ id: string }>(
    `INSERT INTO support_tickets(workspace_id, created_by_user_id, subject, status, priority)
     VALUES($1,$2,$3,'OPEN',$4) RETURNING id`,
    [workspaceId, userId, subject, priority],
  );

  return NextResponse.json({ ticket: { id: result.rows[0].id } }, { status: 201 });
}
