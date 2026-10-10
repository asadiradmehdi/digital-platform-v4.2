import type { NextRequest } from 'next/server';
import { adminMutation } from '../../../../../../server/admin/http';
import { AppError } from '../../../../../../server/core/errors';
import { requireUuid } from '../../../../../../server/core/validation';
import { assignTicket, replyAsStaff, setTicketStatus } from '../../../../../../server/admin/support';

type Params = { params: Promise<{ id: string }> };

/** Body {action:'reply',body} | {action:'status',status:'CLOSED'|'OPEN'} | {action:'assign',assigneeId:uuid|null}. */
export async function POST(request: NextRequest, { params }: Params) {
  return adminMutation(request, async ({ actorUserId, body }) => {
    const ticketId = requireUuid((await params).id, 'ticketId');
    switch (body.action) {
      case 'reply': return replyAsStaff({ actorUserId, ticketId, body: body.body });
      case 'status': return setTicketStatus({ actorUserId, ticketId, status: body.status });
      case 'assign': return assignTicket({ actorUserId, ticketId, assigneeId: body.assigneeId });
      default: throw new AppError('VALIDATION_ERROR', 'عملیات نامعتبر است.');
    }
  });
}
