import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { requireAdminAccess, requirePermission } from '../../../../../../../server/admin/access';
import { assertSameOrigin } from '../../../../../../../server/core/security-boundary';
import { AppError } from '../../../../../../../server/core/errors';
import { applyBulk, approveAllDrafts, previewBulk } from '../../../../../../../server/admin/catalog';
import { undoPriceGroup } from '../../../../../../../server/admin/packages';
import { requireUuid } from '../../../../../../../server/core/validation';

/**
 * Category-wide tools. Body {mode:'preview'|'apply', productSlug, percent, roundTo?} or
 * {mode:'approve-drafts', productSlug?} (no slug = every category), or {mode:'undo', groupId} to undo a whole category-wide change.
 */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const actorUserId = await requireRequestUser(request);
    await requireAdminAccess(actorUserId);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.mode === 'preview') return json(await previewBulk({ actorUserId, ...pick(body) }), { correlationId: id });
    if (body.mode === 'apply') return json(await applyBulk({ actorUserId, ...pick(body) }), { correlationId: id });
    if (body.mode === 'undo') return json(await undoPriceGroup({ actorUserId, groupId: requireUuid(body.groupId, 'groupId') }), { correlationId: id });
    if (body.mode === 'approve-drafts') {
      const slug = body.productSlug == null ? null : String(body.productSlug);
      if (slug !== null && !/^[a-z0-9-]{1,40}$/.test(slug)) throw new AppError('VALIDATION_ERROR', 'دسته نامعتبر است.');
      return json(await approveAllDrafts({ actorUserId, productSlug: slug }), { correlationId: id });
    }
    throw new AppError('VALIDATION_ERROR', 'عملیات نامعتبر است.');
  } catch (e) {
    return handleRouteError(e, id);
  }
}
const pick = (b: Record<string, unknown>) => ({ productSlug: b.productSlug, percent: b.percent, roundTo: b.roundTo });
