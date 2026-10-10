import type { NextRequest } from 'next/server';
import { adminMutation } from '../../../../../../../../server/admin/http';
import { requireUuid } from '../../../../../../../../server/core/validation';
import { createVariant } from '../../../../../../../../server/admin/catalog-meta';

type Params = { params: Promise<{ id: string }> };

/** Body {variant:'iranian'|'foreign'|'economy'|'premium', name?}: creates a variant of the base service with an inactive draft price. */
export async function POST(request: NextRequest, { params }: Params) {
  return adminMutation(request, async ({ actorUserId, body }) =>
    createVariant({ actorUserId, baseServiceId: requireUuid((await params).id, 'serviceId'), variant: body.variant, name: body.name }), 201);
}
