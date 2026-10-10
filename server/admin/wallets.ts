// Admin user profile and manual wallet adjustments. The wallet ledger is append-only: a credit/debit is one new
// ledger_entries row written through the same helpers as every other money flow (lock the MAIN account, convert toman
// to the wallet currency, idempotent per key), in the customer's tenant transaction together with its audit row.
import { query, withTenantTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { requirePermission } from './access';
import { debitWalletChecked, postWalletEntry, requireMainWalletAccount, walletBalanceMinor } from '../payments/wallet-ledger';
import { notifyUser } from '../notifications/inbox';
import { getTierLadder, tierForLadder } from '../loyalty/tier-ladder';

/** Wallet minor units to toman (the wallet is kept in rial, 1 toman = 10 rial). */
const fromWalletMinor = (minor: bigint, currency: string): number => Number(currency.trim() === 'IRR' ? minor / 10n : minor);

/** Safety cap for one manual adjustment (toman). Bigger corrections are done in several reviewed steps. */
export const MAX_ADJUSTMENT_TOMAN = 20_000_000;
export const MIN_REASON = 8;
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export type UserProfile = {
  userId: string; displayName: string; email: string | null; phone: string | null; status: string; createdAt: string; lastLoginAt: string | null;
  isAdmin: boolean; workspaceId: string | null;
  spentToman: number; orderCount: number; tier: { name: string; level: number; levels: number; nextName: string | null; remainingToman: number; progress: number } | null;
  wallet: { balanceToman: number; entries: { id: string; direction: 'CREDIT' | 'DEBIT'; amountToman: number; referenceType: string; label: string | null; reason: string | null; actorName: string | null; createdAt: string }[] } | null;
  tickets: { id: string; code: string; subject: string; status: string }[];
};

export async function getUserProfile(actorUserId: string, userId: string): Promise<UserProfile> {
  await requirePermission(actorUserId, 'users.view');
  if (!isUuid(userId)) throw new AppError('NOT_FOUND', 'کاربر پیدا نشد.');
  const u = (await query<{ id: string; display_name: string | null; email: string | null; phone: string | null; status: string; created_at: string; last_login_at: string | null; is_admin: boolean; workspace_id: string | null }>(
    `SELECT u.id, u.display_name, u.email, u.phone, u.status::text, u.created_at::text, NULL::text AS last_login_at,
            EXISTS(SELECT 1 FROM workspace_members wm JOIN member_roles mr ON mr.member_id=wm.id JOIN roles r ON r.id=mr.role_id
                   WHERE wm.user_id=u.id AND wm.status='ACTIVE' AND r.name='platform_admin' AND r.workspace_id IS NULL AND r.is_system) AS is_admin,
            (SELECT w.id FROM workspaces w WHERE w.owner_user_id=u.id ORDER BY w.created_at LIMIT 1) AS workspace_id
     FROM users u WHERE u.id=$1 AND u.deleted_at IS NULL`, [userId])).rows[0];
  if (!u) throw new AppError('NOT_FOUND', 'کاربر پیدا نشد.');
  const base = { userId: u.id, displayName: u.display_name ?? 'کاربر', email: u.email, phone: u.phone, status: u.status, createdAt: u.created_at, lastLoginAt: u.last_login_at, isAdmin: u.is_admin, workspaceId: u.workspace_id };
  if (!u.workspace_id) return { ...base, spentToman: 0, orderCount: 0, tier: null, wallet: null, tickets: [] };
  const ladder = await getTierLadder();
  return withTenantTransaction(u.workspace_id, actorUserId, async c => {
    const stats = (await c.query<{ spent: string; orders: string }>(
      `SELECT (SELECT COALESCE(SUM(CASE WHEN currency='IRR' THEN amount_minor/10 ELSE amount_minor END),0) FROM payments WHERE workspace_id=$1 AND status='PAID' AND order_id IS NOT NULL)::text AS spent,
              (SELECT COUNT(*) FROM orders WHERE workspace_id=$1)::text AS orders`, [u.workspace_id])).rows[0];
    const w = (await c.query<{ id: string; currency: string; balance: string }>(
      `SELECT w.id, w.currency, COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE -le.amount_minor END),0)::text AS balance
       FROM wallets w LEFT JOIN ledger_accounts la ON la.wallet_id=w.id LEFT JOIN ledger_entries le ON le.account_id=la.id
       WHERE w.workspace_id=$1 GROUP BY w.id, w.currency ORDER BY w.created_at LIMIT 1`, [u.workspace_id])).rows[0];
    let wallet: UserProfile['wallet'] = null;
    if (w) {
      const cur = w.currency.trim();
      const e = await c.query<{ id: string; direction: 'CREDIT' | 'DEBIT'; amount_minor: string; currency: string; reference_type: string; label: string | null; reason: string | null; actor_name: string | null; created_at: string }>(
        `SELECT le.id, le.direction::text, le.amount_minor::text, le.currency, le.reference_type, le.metadata->>'label' AS label, le.metadata->>'reason' AS reason,
                au.display_name AS actor_name, le.created_at::text
         FROM ledger_entries le JOIN ledger_accounts la ON la.id=le.account_id
         LEFT JOIN users au ON au.id::text = le.metadata->>'actorUserId'
         WHERE la.wallet_id=$1 ORDER BY le.created_at DESC, le.id DESC LIMIT 30`, [w.id]);
      wallet = {
        balanceToman: fromWalletMinor(BigInt(w.balance), cur),
        entries: e.rows.map(x => ({ id: x.id, direction: x.direction, amountToman: fromWalletMinor(BigInt(x.amount_minor), x.currency.trim()), referenceType: x.reference_type, label: x.label, reason: x.reason, actorName: x.actor_name, createdAt: x.created_at })),
      };
    }
    const spent = Number(stats?.spent ?? 0);
    const t = tierForLadder(ladder, spent);
    const tk = await c.query<{ id: string; code: string; subject: string; status: string }>(
      `SELECT id, code, subject, status FROM support_tickets WHERE workspace_id=$1 ORDER BY last_message_at DESC LIMIT 5`, [u.workspace_id]);
    return {
      ...base, spentToman: spent, orderCount: Number(stats?.orders ?? 0),
      tier: { name: t.tier.name, level: t.level, levels: t.levels, nextName: t.next?.name ?? null, remainingToman: t.remainingToman, progress: t.progress },
      wallet, tickets: tk.rows,
    };
  });
}

export type AdjustInput = { actorUserId: string; userId: string; direction: unknown; amountToman: unknown; reason: unknown; idempotencyKey: string | null };

/**
 * Manual credit/debit of a customer's wallet. Mandatory reason, per-operation cap, idempotency key required (a retry with the
 * same key changes nothing and returns replayed:true). A debit can never take the balance below zero.
 */
export async function adjustWallet(input: AdjustInput) {
  await requirePermission(input.actorUserId, 'wallet.adjust');
  const direction = input.direction === 'CREDIT' || input.direction === 'DEBIT' ? input.direction : null;
  if (!direction) throw new AppError('VALIDATION_ERROR', 'نوع عملیات باید افزایش یا کاهش باشد.');
  if (!isUuid(input.userId)) throw new AppError('NOT_FOUND', 'کاربر پیدا نشد.');
  const amount = typeof input.amountToman === 'number' ? input.amountToman : NaN;
  if (!Number.isSafeInteger(amount) || amount < 1) throw new AppError('VALIDATION_ERROR', 'مبلغ را به‌صورت عدد صحیح و بزرگ‌تر از صفر وارد کنید.');
  if (amount > MAX_ADJUSTMENT_TOMAN) throw new AppError('VALIDATION_ERROR', `هر اصلاح حداکثر ${MAX_ADJUSTMENT_TOMAN.toLocaleString('fa-IR')} تومان است.`);
  const reason = typeof input.reason === 'string' ? input.reason.replace(/\s+/g, ' ').trim() : '';
  if (Array.from(reason).length < MIN_REASON) throw new AppError('VALIDATION_ERROR', `دلیل را حداقل ${MIN_REASON} حرف بنویسید.`);
  if (Array.from(reason).length > 300) throw new AppError('VALIDATION_ERROR', 'دلیل حداکثر ۳۰۰ حرف است.');
  const key = input.idempotencyKey;
  if (!key || key.length < 8) throw new AppError('VALIDATION_ERROR', 'کلید جلوگیری از تکرار (Idempotency-Key) لازم است.');

  const ws = (await query<{ id: string }>(`SELECT w.id FROM workspaces w JOIN users u ON u.id=w.owner_user_id WHERE u.id=$1 AND u.deleted_at IS NULL ORDER BY w.created_at LIMIT 1`, [input.userId])).rows[0];
  if (!ws) throw new AppError('NOT_FOUND', 'کاربر یا کیف پول پیدا نشد.');
  const workspaceId = ws.id;

  return withTenantTransaction(workspaceId, input.actorUserId, async c => {
    const wallet = await requireMainWalletAccount(c, workspaceId);
    const entry = {
      amountMinor: BigInt(amount), currency: 'IRT', referenceType: 'ADMIN_ADJUSTMENT', referenceId: null as string | null,
      idempotencyKey: `admin-adj:${key}`, label: direction === 'CREDIT' ? 'افزایش موجودی توسط پشتیبانی' : 'کاهش موجودی توسط پشتیبانی',
      metadata: { actorUserId: input.actorUserId, reason },
    };
    const posted = direction === 'CREDIT' ? await postWalletEntry(c, wallet, { ...entry, direction: 'CREDIT' }) : await debitWalletChecked(c, wallet, entry);
    const balance = await walletBalanceMinor(c, wallet.accountId);
    const balanceToman = fromWalletMinor(balance, wallet.walletCurrency);
    if (!posted.inserted) return { replayed: true, balanceToman };
    await writeAudit({ workspaceId, actorUserId: input.actorUserId, action: direction === 'CREDIT' ? 'admin.wallet.credit' : 'admin.wallet.debit', entityType: 'wallet', entityId: wallet.accountId,
      metadata: { userId: input.userId, amountToman: amount, reason, idempotencyKey: key, balanceAfterToman: balanceToman } }, c);
    await notifyUser({ workspaceId, userId: input.userId, type: 'wallet.adjusted', category: 'payments',
      title: direction === 'CREDIT' ? `${amount.toLocaleString('fa-IR')} تومان به کیف پول شما افزوده شد` : `${amount.toLocaleString('fa-IR')} تومان از کیف پول شما کسر شد`,
      body: reason.slice(0, 140), link: '/wallet' }, c);
    return { replayed: false, balanceToman };
  });
}
