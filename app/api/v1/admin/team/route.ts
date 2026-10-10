import type { NextRequest } from 'next/server';
import { adminMutation } from '../../../../../server/admin/http';
import { AppError } from '../../../../../server/core/errors';
import { addMember, removeMember, revokeInvite, setMemberStatus, updateMember } from '../../../../../server/admin/team';

/**
 * Team management (needs team.manage; granting is limited to the caller's own permissions, see server/admin/team.ts).
 * Body {action}: add {contact,title?,preset?|permissions[]} | update {userId,title?,preset?|permissions[]} | status {userId,status} | remove {userId} | revoke_invite {inviteId}
 */
export async function POST(request: NextRequest) {
  return adminMutation(request, async ({ actorUserId, body }) => {
    switch (body.action) {
      case 'add': return addMember({ actorUserId, contact: body.contact, title: body.title, preset: body.preset, permissions: body.permissions });
      case 'update': return updateMember({ actorUserId, userId: body.userId, title: body.title, preset: body.preset, permissions: body.permissions });
      case 'status': return setMemberStatus({ actorUserId, userId: body.userId, status: body.status });
      case 'remove': return removeMember({ actorUserId, userId: body.userId });
      case 'revoke_invite': return revokeInvite({ actorUserId, inviteId: body.inviteId });
      default: throw new AppError('VALIDATION_ERROR', 'عملیات نامعتبر است.');
    }
  });
}
