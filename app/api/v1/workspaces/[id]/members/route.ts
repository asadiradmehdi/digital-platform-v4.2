import { NextRequest } from 'next/server';
import { query } from '../../../../../../server/core/db';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../../server/identity/rbac';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { assertSameOrigin, clientFingerprint } from '../../../../../../server/core/security-boundary';
import { recordSecurityEvent } from '../../../../../../server/core/security-events';
import { requireString } from '../../../../../../server/core/validation';
import { AppError } from '../../../../../../server/core/errors';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    const { id: workspaceId } = await params;
    const userId = await requireRequestUser(request);
    await requireWorkspacePermission(userId, workspaceId, 'workspace.members.read');
    const r = await query(
      `SELECT wm.id, wm.user_id, wm.status, u.email, u.display_name,
              COALESCE(json_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '[]') AS roles
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       LEFT JOIN member_roles mr ON mr.member_id = wm.id
       LEFT JOIN roles r ON r.id = mr.role_id
       WHERE wm.workspace_id = $1 AND wm.status != 'REMOVED'
       GROUP BY wm.id, wm.user_id, wm.status, u.email, u.display_name
       ORDER BY wm.created_at`,
      [workspaceId]
    );
    return json({ items: r.rows }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const { id: workspaceId } = await params;
    const adminId = await requireRequestUser(request);
    const ip = clientFingerprint(request);
    await requireWorkspacePermission(adminId, workspaceId, 'workspace.members.manage');
    const body = await request.json() as Record<string, unknown>;
    const memberId = requireString(body.memberId, 'memberId', 1, 100);
    const action = requireString(body.action, 'action', 1, 50);

    // Resolve the member row and the affected user id.
    const mr = await query<{ user_id: string }>(
      `SELECT user_id FROM workspace_members WHERE id=$1 AND workspace_id=$2`,
      [memberId, workspaceId]
    );
    const member = mr.rows[0];
    if (!member) throw new AppError('NOT_FOUND', 'Member not found.');

    if (action === 'remove') {
      await query(
        `UPDATE workspace_members SET status='REMOVED', updated_at=now() WHERE id=$1`,
        [memberId]
      );
      // Revoke all sessions for the removed user (they lose workspace access immediately).
      await query(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [member.user_id]);
      await recordSecurityEvent({ eventType: 'WORKSPACE_MEMBER_REMOVED', severity: 'INFO', userId: adminId, correlationId: id, sourceIp: ip, metadata: { workspaceId, targetUserId: member.user_id } });
      return json({ ok: true }, { correlationId: id });
    }

    if (action === 'assign_role') {
      const roleName = requireString(body.role, 'role', 1, 100);
      const roleRow = await query<{ id: string }>(
        `SELECT id FROM roles WHERE workspace_id=$1 AND name=$2`,
        [workspaceId, roleName]
      );
      if (!roleRow.rows[0]) throw new AppError('NOT_FOUND', `Role '${roleName}' not found.`);
      await query(
        `INSERT INTO member_roles(member_id, role_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
        [memberId, roleRow.rows[0].id]
      );
      // Rotate sessions of the affected user so new permissions take effect immediately.
      await query(
        `UPDATE sessions SET expires_at=now()+interval '30 seconds'
         WHERE user_id=$1 AND revoked_at IS NULL AND expires_at > now()`,
        [member.user_id]
      );
      await recordSecurityEvent({ eventType: 'MEMBER_ROLE_ASSIGNED', severity: 'INFO', userId: adminId, correlationId: id, sourceIp: ip, metadata: { workspaceId, targetUserId: member.user_id, role: roleName } });
      return json({ ok: true }, { correlationId: id });
    }

    if (action === 'revoke_role') {
      const roleName = requireString(body.role, 'role', 1, 100);
      const roleRow = await query<{ id: string }>(
        `SELECT id FROM roles WHERE workspace_id=$1 AND name=$2`,
        [workspaceId, roleName]
      );
      if (!roleRow.rows[0]) throw new AppError('NOT_FOUND', `Role '${roleName}' not found.`);
      await query(
        `DELETE FROM member_roles WHERE member_id=$1 AND role_id=$2`,
        [memberId, roleRow.rows[0].id]
      );
      // On privilege revocation, revoke all active sessions immediately (re-auth enforces new permissions).
      await query(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [member.user_id]);
      await recordSecurityEvent({ eventType: 'MEMBER_ROLE_REVOKED', severity: 'WARNING', userId: adminId, correlationId: id, sourceIp: ip, metadata: { workspaceId, targetUserId: member.user_id, role: roleName } });
      return json({ ok: true }, { correlationId: id });
    }

    throw new AppError('VALIDATION_ERROR', `Unknown action '${action}'.`);
  } catch (e) {
    return handleRouteError(e, id);
  }
}
