import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCurrentUser } from '../../../../../server/identity/request-user';
import { MAX_ADJUSTMENT_TOMAN, getUserProfile } from '../../../../../server/admin/wallets';
import { AppError } from '../../../../../server/core/errors';
import { EmptyState, PageHead, TICKET_STATUS_FA, faDate, fa, toman } from '../../ui';
import { CopyButton } from '../../kit';
import { StatusButton } from '../StatusButton';
import { WalletAdjust } from './WalletAdjust';

const STATUS_FA: Record<string, [string, string]> = { ACTIVE: ['فعال', 'ok'], SUSPENDED: ['مسدود', 'bad'], DELETED: ['حذف‌شده', ''] };
const REF_FA: Record<string, string> = { TOPUP: 'شارژ', ORDER: 'خرید', REFUND: 'بازگشت وجه', ADMIN_ADJUSTMENT: 'اصلاح پشتیبانی', SUBSCRIPTION: 'اشتراک' };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireCurrentUser();
  let u;
  try { u = await getUserProfile(actor, id); } catch (e) { if (e instanceof AppError && e.code === 'NOT_FOUND') notFound(); throw e; }
  const [label, tone] = STATUS_FA[u.status] ?? [u.status, ''];
  return (
    <>
      <PageHead title={u.displayName} hint={`عضو از ${faDate(u.createdAt)}`} back={{ href: '/admin/users', label: 'همه‌ی کاربران' }}><span className={`zpa-tag ${tone}`}>{label}</span></PageHead>

      <section className="zpa-sec" aria-labelledby="u-prof"><h2 id="u-prof">مشخصات</h2>
        <dl className="zpa-panel zpa-kv">
          {u.phone ? <div><dt>موبایل</dt><dd className="ltr">{u.phone} <CopyButton text={u.phone} /></dd></div> : null}
          {u.email ? <div><dt>ایمیل</dt><dd className="ltr">{u.email}</dd></div> : null}
          <div><dt>سطح وفاداری</dt><dd>{u.tier ? `${u.tier.name} (سطح ${fa(u.tier.level)} از ${fa(u.tier.levels)})` : '—'}</dd></div>
          {u.tier?.nextName ? <div><dt>تا سطح «{u.tier.nextName}»</dt><dd>{toman(u.tier.remainingToman)} خرید دیگر</dd></div> : null}
          <div><dt>مجموع خرید</dt><dd>{toman(u.spentToman)}</dd></div>
          <div><dt>سفارش‌ها</dt><dd><Link className="zpa-link" href={`/admin/orders?user=${u.userId}`}>{fa(u.orderCount)} سفارش ›</Link></dd></div>
          {u.isAdmin ? <div><dt>نقش</dt><dd>مدیر پلتفرم</dd></div> : null}
        </dl>
        {!u.isAdmin && u.status !== 'DELETED' ? <div style={{ marginTop: 10 }}><StatusButton userId={u.userId} name={u.displayName} status={u.status} /></div> : null}
      </section>

      <section className="zpa-sec" aria-labelledby="u-wal"><h2 id="u-wal">کیف پول</h2>
        {!u.wallet ? <div className="zpa-panel"><EmptyState title="کیف پولی ندارد" hint="برای این کاربر هنوز کیف پول ساخته نشده است." /></div> : (
          <>
            <div className="zpa-panel zpa-stack">
              <div><small className="zpa-muted">موجودی</small><div style={{ fontSize: 24, fontWeight: 800 }}>{toman(u.wallet.balanceToman)}</div></div>
              {u.status !== 'DELETED' ? <WalletAdjust userId={u.userId} name={u.displayName} balanceToman={u.wallet.balanceToman} max={MAX_ADJUSTMENT_TOMAN} /> : null}
            </div>
            <h3 style={{ margin: '16px 0 8px', fontSize: 14 }}>آخرین تراکنش‌ها</h3>
            {u.wallet.entries.length === 0 ? <div className="zpa-panel"><EmptyState title="تراکنشی نیست" /></div> : (
              <ul className="zpa-list">
                {u.wallet.entries.map(e => (
                  <li key={e.id} className="zpa-item">
                    <div className="zpa-item-top"><b>{e.label ?? REF_FA[e.referenceType] ?? e.referenceType}</b><span className="zpa-item-end" style={{ color: e.direction === 'CREDIT' ? 'var(--success)' : 'var(--danger)' }}>{e.direction === 'CREDIT' ? '+' : '−'}{toman(e.amountToman)}</span></div>
                    <div className="zpa-item-sub"><span>{faDate(e.createdAt)}</span>{e.reason ? <span>دلیل: {e.reason}</span> : null}{e.actorName ? <span>{e.actorName}</span> : null}</div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="zpa-sec" aria-labelledby="u-tk"><h2 id="u-tk">تیکت‌ها</h2>
        {u.tickets.length === 0 ? <div className="zpa-panel"><EmptyState title="تیکتی ندارد" /></div> : (
          <ul className="zpa-list">{u.tickets.map(t => {
            const [l, tn] = TICKET_STATUS_FA[t.status] ?? [t.status, ''];
            return <li key={t.id}><Link className="zpa-item" href={`/admin/support/${t.id}`}><div className="zpa-item-top"><b>{t.subject}</b><span className={`zpa-tag ${tn}`}>{l}</span></div><div className="zpa-item-sub"><span className="zpa-ltr">{t.code}</span></div></Link></li>;
          })}</ul>
        )}
      </section>
    </>
  );
}
