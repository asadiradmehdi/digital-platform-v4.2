import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requireAdminAccess, requirePermission } from '../../../../../../server/admin/access';
import { assertSameOrigin } from '../../../../../../server/core/security-boundary';
import { AppError } from '../../../../../../server/core/errors';
import { saveLoyalty, saveReferral, saveSite } from '../../../../../../server/admin/site-settings';
import { saveGateway, saveGoogle, saveInvoice, saveLicenses, saveSms, setSupportHours, upsertSupportContact } from '../../../../../../server/admin/settings';

type Params = { params: Promise<{ section: string }> };

/**
 * Saves one settings section. The response never contains a secret (only {ok:true}); secrets are write-only.
 * Sections: sms, google, gateway, invoice, licenses, site, referral, loyalty, support-hours, support-contact.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const { section } = await params;
    const actorUserId = await requireRequestUser(request);
    await requireAdminAccess(actorUserId);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('VALIDATION_ERROR', 'اطلاعات ارسالی معتبر نیست.');
    if (section === 'support-hours' || section === 'support-contact') await requirePermission(actorUserId, 'settings.edit');
    const ctx = { actorUserId, stepUpEvidenceId: typeof body.stepUpEvidenceId === 'string' ? body.stepUpEvidenceId : undefined };
    switch (section) {
      case 'sms': await saveSms(ctx, body); break;
      case 'google': await saveGoogle(ctx, body); break;
      case 'gateway': await saveGateway(ctx, body); break;
      case 'invoice': await saveInvoice(ctx, body); break;
      case 'licenses': await saveLicenses(ctx, body); break;
      case 'site': await saveSite(actorUserId, body); break;
      case 'referral': await saveReferral(actorUserId, body); break;
      case 'loyalty': await saveLoyalty(actorUserId, body); break;
      case 'support-hours': await setSupportHours(String(body.hours ?? ''), actorUserId); break;
      case 'support-contact':
        await upsertSupportContact({
          id: typeof body.id === 'string' ? body.id : undefined, label: String(body.label ?? ''), phone: String(body.phone ?? ''),
          sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined, active: typeof body.active === 'boolean' ? body.active : undefined,
        }, actorUserId);
        break;
      default: throw new AppError('NOT_FOUND', 'بخش تنظیمات پیدا نشد.');
    }
    return json({ ok: true }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
