import Link from 'next/link';
import { requireCurrentUser } from '../../../../server/identity/request-user';
import { PAGE_SIZE, listAdminTickets, listStaff } from '../../../../server/admin/support';
import { normalizeDigits } from '../../../../lib/admin-pricing';
import { Chips, EmptyState, PageHead, Pager, TICKET_CATEGORY_FA, TICKET_STATUS_FA, ago } from '../ui';

const FILTERS: Array<[string, string]> = [['ACTIVE', 'باز'], ['OPEN', 'جدید'], ['PENDING', 'منتظر پاسخ ما'], ['ANSWERED', 'پاسخ داده‌شده'], ['CLOSED', 'بسته'], ['', 'همه']];

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const userId = await requireCurrentUser();
  const sp = await searchParams;
  const status = sp.status === undefined ? 'ACTIVE' : sp.status;
  const q = normalizeDigits(sp.q ?? '').trim().slice(0, 80);
  const assignee = sp.assignee ?? '';
  const [{ rows, total, page }, staff] = await Promise.all([listAdminTickets(userId, { status: status || null, search: q || null, assignee: assignee || null, page: Number(sp.page) }), listStaff(userId)]);
  const href = (over: Record<string, string>) => {
    const cur: Record<string, string> = { status, q, assignee, ...over };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(cur)) if (v || k === 'status') p.set(k, v);
    return `/admin/support?${p.toString()}`;
  };

  return (
    <>
      <PageHead title="پشتیبانی" hint={`${total.toLocaleString('fa-IR')} تیکت`}>
        <Link className="zpa-btn ghost sm" href="/admin/settings/support">شماره‌ها و ساعت کاری</Link>
      </PageHead>
      <form method="get" action="/admin/support" className="zpa-filters" role="search">
        <div className="zpa-search">
          <input type="search" name="q" defaultValue={q} placeholder="کد تیکت، موضوع، نام یا موبایل" maxLength={80} aria-label="جست‌وجوی تیکت" />
          <button className="zpa-btn" type="submit">جست‌وجو</button>
        </div>
        <select name="assignee" defaultValue={assignee} aria-label="مسئول">
          <option value="">همه‌ی مسئول‌ها</option><option value="none">بدون مسئول</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="hidden" name="status" value={status} />
      </form>
      <Chips label="فیلتر وضعیت تیکت" items={FILTERS.map(([s, l]) => ({ href: href({ status: s }), label: l, active: status === s }))} />
      {rows.length === 0 ? <div className="zpa-panel"><EmptyState title="تیکتی پیدا نشد" hint={q || assignee || status !== 'ACTIVE' ? 'فیلترها را تغییر دهید.' : 'تیکت بازی وجود ندارد؛ کار عقب‌مانده‌ای نیست.'} /></div> : (
        <ul className="zpa-list">
          {rows.map(t => {
            const [label, tone] = TICKET_STATUS_FA[t.status] ?? [t.status, ''];
            return (
              <li key={t.ticketId}>
                <Link className="zpa-item" href={`/admin/support/${t.ticketId}`}>
                  <div className="zpa-item-top"><b>{t.subject}</b><span className="zpa-item-end">{ago(t.lastMessageAt)}</span></div>
                  {t.preview ? <div className="zpa-item-sub" style={{ display: 'block' }}>{t.lastAuthor === 'STAFF' ? 'ما: ' : ''}{t.preview}</div> : null}
                  <div className="zpa-item-sub">
                    <span className={`zpa-tag ${tone}`}>{label}</span>
                    <span>{t.customerName ?? '—'}</span>
                    <span className="zpa-ltr">{t.code}</span>
                    <span>{TICKET_CATEGORY_FA[t.category] ?? t.category}</span>
                    {t.assignedName ? <span className="zpa-tag info">{t.assignedName}</span> : t.status !== 'CLOSED' ? <span className="zpa-tag warn">بدون مسئول</span> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pager base={href({})} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
