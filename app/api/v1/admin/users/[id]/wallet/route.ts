import type { NextRequest } from 'next/server';
import { adminMutation } from '../../../../../../../server/admin/http';
import { requireUuid } from '../../../../../../../server/core/validation';
import { adjustWallet } from '../../../../../../../server/admin/wallets';

type Params = { params: Promise<{ id: string }> };

/** Body {direction:'CREDIT'|'DEBIT', amountToman:int, reason:string}; Idempotency-Key header is required. */
export async function POST(request: NextRequest, { params }: Params) {
  return adminMutation(request, async ({ actorUserId, body, idempotencyKey }) =>
    adjustWallet({ actorUserId, userId: requireUuid((await params).id, 'userId'), direction: body.direction, amountToman: body.amountToman, reason: body.reason, idempotencyKey }));
}
