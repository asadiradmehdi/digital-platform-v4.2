import type { NextRequest } from 'next/server';
import { adminMutation } from '../../../../../../../server/admin/http';
import { AppError } from '../../../../../../../server/core/errors';
import { requireUuid } from '../../../../../../../server/core/validation';
import { addOrderNote, changeOrderStatus, deliverOrder, refundOrCancel } from '../../../../../../../server/admin/orders';

type Params = { params: Promise<{ id: string }> };

/**
 * One admin mutation endpoint for an order. Body {action}:
 *  status {to, note?} | note {body} | deliver {note?, proofUrl?} | refund {amountToman?, reason} | cancel {reason}
 * refund/cancel require the Idempotency-Key header (a retry with the same key never pays twice).
 */
export async function POST(request: NextRequest, { params }: Params) {
  return adminMutation(request, async ({ actorUserId, body, idempotencyKey }) => {
    const orderId = requireUuid((await params).id, 'orderId');
    switch (body.action) {
      case 'status': return changeOrderStatus({ actorUserId, orderId, to: body.to, note: body.note });
      case 'note': return addOrderNote({ actorUserId, orderId, body: body.body });
      case 'deliver': return deliverOrder({ actorUserId, orderId, note: body.note, proofUrl: body.proofUrl });
      case 'refund': return refundOrCancel({ actorUserId, orderId, mode: 'REFUND', amountToman: body.amountToman, reason: body.reason, idempotencyKey });
      case 'cancel': return refundOrCancel({ actorUserId, orderId, mode: 'CANCEL', reason: body.reason, idempotencyKey });
      default: throw new AppError('VALIDATION_ERROR', 'عملیات نامعتبر است.');
    }
  });
}
