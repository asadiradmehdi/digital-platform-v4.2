import { isIP } from 'node:net';
import { withUserTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { isPlatformAdmin } from '../identity/platform-admin';
import { requirePermission } from './access';

export type ManagedUserStatus = 'ACTIVE' | 'SUSPENDED';

/**
 * Suspends or re-activates a customer account (platform admin only). Suspension ends all live sessions at
 * once and resolveSession() refuses sessions of non-ACTIVE users, so it takes effect on the next request.
 * The change and its audit row commit together. Admins cannot suspend themselves or another platform admin.
 */
export async function setUserStatus(input: { actorUserId: string; targetUserId: string; status: ManagedUserStatus; reason?: string; ip?: string }) {
  await requirePermission(input.actorUserId, 'users.manage');
  if (input.status !== 'ACTIVE' && input.status !== 'SUSPENDED') throw new AppError('VALIDATION_ERROR', 'وضعیت نامعتبر است.');
  if (input.status === 'SUSPENDED') {
    if (input.targetUserId === input.actorUserId) throw new AppError('VALIDATION_ERROR', 'نمی‌توانید حساب خودتان را مسدود کنید.');
    if (await isPlatformAdmin(input.targetUserId)) throw new AppError('VALIDATION_ERROR', 'حساب مدیران پلتفرم قابل مسدود شدن نیست.');
  }
  const reason = (input.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || undefined;
  return withUserTransaction(input.actorUserId, async client => {
    const cur = await client.query<{ status: string }>(`SELECT status FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [input.targetUserId]);
    const from = cur.rows[0]?.status;
    if (!from) throw new AppError('NOT_FOUND', 'کاربر پیدا نشد.');
    if (from === 'DELETED') throw new AppError('VALIDATION_ERROR', 'این حساب حذف شده است.');
    if (from === input.status) return { changed: false, status: from };
    await client.query(`UPDATE users SET status=$2 WHERE id=$1`, [input.targetUserId, input.status]);
    if (input.status === 'SUSPENDED') await client.query(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [input.targetUserId]);
    await writeAudit({
      actorUserId: input.actorUserId, ip: input.ip && isIP(input.ip) ? input.ip : undefined, action: input.status === 'SUSPENDED' ? 'admin.user.suspend' : 'admin.user.activate',
      entityType: 'user', entityId: input.targetUserId, metadata: { from, to: input.status, reason },
    }, client);
    return { changed: true, status: input.status };
  });
}
