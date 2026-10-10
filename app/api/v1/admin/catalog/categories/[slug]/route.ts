import type { NextRequest } from 'next/server';
import { adminMutation } from '../../../../../../../server/admin/http';
import { AppError } from '../../../../../../../server/core/errors';
import { setCategoryActive } from '../../../../../../../server/admin/catalog-meta';

type Params = { params: Promise<{ slug: string }> };

/** Body {active:boolean}: shows or hides a whole category for customers. */
export async function POST(request: NextRequest, { params }: Params) {
  return adminMutation(request, async ({ actorUserId, body }) => {
    if (typeof body.active !== 'boolean') throw new AppError('VALIDATION_ERROR', 'active باید true یا false باشد.');
    return setCategoryActive({ actorUserId, productSlug: (await params).slug, active: body.active });
  });
}
