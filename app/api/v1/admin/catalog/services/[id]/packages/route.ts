import type { NextRequest } from 'next/server';
import { adminMutation } from '../../../../../../../../server/admin/http';
import { requireUuid } from '../../../../../../../../server/core/validation';
import { AppError } from '../../../../../../../../server/core/errors';
import { previewPackageChanges, savePackageChanges, setUnitCost, undoLastPriceChange } from '../../../../../../../../server/admin/packages';

type Params = { params: Promise<{ id: string }> };

/**
 * Package prices of one service. Body {mode}:
 *  - preview {edits:[{quantity, priceToman|null}]}  → plan (changes + packages pinned because the base price moves), nothing written
 *  - save    {edits, note?}                         → applies in one transaction (Idempotency-Key header honoured)
 *  - undo                                           → restores the state before the latest change (new batch, history kept)
 *  - cost    {unitCostToman|null, note?}            → what one unit costs us, for margin
 */
export async function POST(request: NextRequest, { params }: Params) {
  return adminMutation(request, async ({ actorUserId, body, idempotencyKey }) => {
    const serviceId = requireUuid((await params).id, 'serviceId');
    switch (body.mode) {
      case 'preview': return previewPackageChanges({ actorUserId, serviceId, edits: body.edits });
      case 'save': return savePackageChanges({ actorUserId, serviceId, edits: body.edits, note: typeof body.note === 'string' ? body.note : null, idempotencyKey });
      case 'undo': return undoLastPriceChange({ actorUserId, serviceId });
      case 'cost': return setUnitCost({ actorUserId, serviceId, unitCostToman: body.unitCostToman, note: typeof body.note === 'string' ? body.note : null });
      default: throw new AppError('VALIDATION_ERROR', 'عملیات نامعتبر است.');
    }
  });
}
