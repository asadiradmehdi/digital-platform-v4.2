import Link from 'next/link';
import { requireCurrentUser } from '../../../../server/identity/request-user';
import { PAGE_SIZE, listAdminUsers } from '../../../../server/admin/console';
import { normalizeDigits } from '../../../../lib/admin-pricing';
import { EmptyState, PageHead, Pager, fa, ago, toman } from '../ui';

const STATUS_FA: Record<string, [string, string]> = { ACTIVE: ['فعال', 'ok'], SUSPENDED: ['مسدود', 'bad'], DELETED: ['حذف‌شده', ''] };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const userId = await requireCurrentUser();
  const sp = await searchParams;
  const q = normalizeDigits(sp.q ?? '').trim().slice(0, 80);
  const { rows, total, page } = await listAdminUsers(userId, { search: q, page: Number(sp.page) });

  return (
    <>
      <PageHead title="کاربران" hint={`${fa(total)} کاربر${q ? ` برای «${q}»` : ''}`} />
      <form method="get" action="/admin/users" className="zpa-filters" role="search">
        <div className="zpa-search">
          <input type="search" name="q" defaultValue={q} placeholder="نام، موبایل یا ایمیل" maxLength={80} aria-label="جست‌وجوی کاربر" enterKeyHint="search" />
          <button className="zpa-btn" type="submit">جست‌وجو</button>
        </div>
      </form>
      {rows.length === 0 ? <div className="zpa-panel"><EmptyState title="کاربری پیدا نشد" hint="عبارت دیگری را جست‌وجو کنید." /></div> : (
        <ul className="zpa-list">
          {rows.map(u => {
            const [label, tone] = STATUS_FA[u.status] ?? [u.status, ''];
            return (
              <li key={u.userId}>
                <Link className="zpa-item" href={`/admin/users/${u.userId}`}>
                  <div className="zpa-item-top"><b>{u.displayName}</b><span className="zpa-item-end">{toman(u.walletToman)}</span></div>
                  <div className="zpa-item-sub">
                    <span className={`zpa-tag ${tone}`}>{label}</span>
                    {u.phone ? <span className="zpa-ltr">{u.phone}</span> : u.email ? <span className="zpa-ltr">{u.email}</span> : null}
                    <span>{fa(u.orderCount)} سفارش</span>
                    <span>عضو از {ago(u.createdAt)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pager base={q ? `/admin/users?q=${encodeURIComponent(q)}` : '/admin/users'} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
