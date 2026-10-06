import { NextRequest } from 'next/server';
import { query } from '../../../../../server/core/db';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { hashPassword, verifyPassword } from '../../../../../server/identity/password';
import { AppError } from '../../../../../server/core/errors';
import { enforceStepUpPolicy } from '../../../../../server/identity/step-up';
import { writeAudit } from '../../../../../server/core/audit';

export async function PATCH(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as { currentPassword?: string; newPassword?: string; stepUpEvidenceId?: string };
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const next = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!current || !next) throw new AppError('VALIDATION_ERROR', 'رمز عبور فعلی و جدید الزامی است.');
    if (next.length < 14) throw new AppError('VALIDATION_ERROR', 'رمز عبور جدید حداقل ۱۴ کاراکتر باشد.');

    await enforceStepUpPolicy(userId, 'SECURITY_SETTINGS_CHANGE', body.stepUpEvidenceId);

    const r = await query<{ credential_hash: string }>(
      `SELECT credential_hash FROM user_credentials WHERE user_id=$1 AND credential_type='password'`,
      [userId],
    );
    const existing = r.rows[0]?.credential_hash;
    if (!existing) throw new AppError('VALIDATION_ERROR', 'این حساب رمز عبور ندارد.');
    const valid = await verifyPassword(current, existing);
    if (!valid) throw new AppError('FORBIDDEN', 'رمز عبور فعلی نادرست است.');

    const newHash = await hashPassword(next);
    await query(
      `INSERT INTO user_credentials(user_id, credential_type, credential_hash)
       VALUES($1,'password',$2)
       ON CONFLICT(user_id, credential_type) DO UPDATE SET credential_hash=EXCLUDED.credential_hash, last_used_at=now()`,
      [userId, newHash],
    );
    await writeAudit({ actorUserId: userId, action: 'PASSWORD_CHANGE', entityType: 'user_credential', entityId: userId });
    return json({ ok: true }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
