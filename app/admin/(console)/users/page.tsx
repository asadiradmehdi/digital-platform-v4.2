import { requireCurrentUser } from '../../../../server/identity/request-user';
import { PAGE_SIZE, listAdminUsers } from '../../../../server/admin/console';
import { EmptyState, PageHead, Pager, fa, faDate, toman } from '../ui';
import { StatusButton } from './StatusButton';

const STATUS_FA: Record<string, [string, string]> = { ACTIVE: ['فعال', 'ok'], SUSPENDED: ['مسدود', 'bad'], DELETED: ['حذف‌شده', ''] };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const userId = await requireCurrentUser();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 80);
  const { rows, total, page } = await listAdminUsers(userId, { search: q, page: Number(sp.page) });

  return (
    <>
      <PageHead title="کاربران" hint={`${fa(total)} کاربر${q ? ` برای «${q}»` : ''}؛ جست‌وجو با نام، شماره‌ی موبایل یا ایمیل.`}>
        <form method="get" action="/admin/users" style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <label className="zpa-field">
            <span style={{ position: 'absolute', left: -9999 }}>جست‌وجوی کاربر</span>
            <input name="q" defaultValue={q} placeholder="نام، موبایل یا ایمیل" maxLength={80} />
          </label>
          <button className="zpa-btn" type="submit">جست‌وجو</button>
        </form>
      </PageHead>
      {rows.length === 0 ? <div className="zpa-panel"><EmptyState title="کاربری پیدا نشد" hint="عبارت دیگری را جست‌وجو کنید." /></div> : (
        <div className="zpa-tablewrap">
          <table className="zpa-table">
            <thead><tr><th>کاربر</th><th>تماس</th><th>موجودی کیف پول</th><th>سفارش‌ها</th><th>عضویت</th><th>وضعیت</th><th>اقدام</th></tr></thead>
            <tbody>
              {rows.map(u => {
                const [label, tone] = STATUS_FA[u.status] ?? [u.status, ''];
                return (
                  <tr key={u.userId}>
                    <td><b>{u.displayName}</b></td>
                    <td>{u.phone ? <span className="zpa-ltr">{u.phone}</span> : null}{u.email ? <><br /><span className="zpa-ltr" style={{ color: 'var(--muted)', fontSize: 12 }}>{u.email}</span></> : null}</td>
                    <td className="zpa-num">{toman(u.walletToman)}</td>
                    <td className="zpa-num">{fa(u.orderCount)}</td>
                    <td>{faDate(u.createdAt)}</td>
                    <td><span className={`zpa-tag ${tone}`}>{label}</span></td>
                    <td><StatusButton userId={u.userId} name={u.displayName} status={u.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager base={q ? `/admin/users?q=${encodeURIComponent(q)}` : '/admin/users'} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
