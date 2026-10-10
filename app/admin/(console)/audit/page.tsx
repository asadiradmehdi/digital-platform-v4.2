import Link from 'next/link';
import { requireCurrentUser } from '../../../../server/identity/request-user';
import { AUDIT_AREAS, AUDIT_PAGE, listAudit } from '../../../../server/admin/audit';
import { EmptyState, PageHead, Pager, faDate } from '../ui';

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const userId = await requireCurrentUser();
  const sp = await searchParams;
  const { rows, total, page } = await listAudit(userId, { action: sp.area, actor: sp.actor, entity: sp.entity, from: sp.from, to: sp.to, page: Number(sp.page) });
  const p = new URLSearchParams();
  for (const k of ['area', 'actor', 'entity', 'from', 'to']) if (sp[k]) p.set(k, sp[k]!);
  const base = `/admin/audit${p.toString() ? `?${p.toString()}` : ''}`;
  return (
    <>
      <PageHead title="گزارش تغییرات" hint={`${total.toLocaleString('fa-IR')} رکورد؛ هر تغییر مدیریتی با نام انجام‌دهنده و زمان (به وقت تهران) ثبت می‌شود.`} />
      <form method="get" action="/admin/audit" className="zpa-filters">
        <select name="area" defaultValue={sp.area ?? ''} aria-label="بخش">
          <option value="">همه‌ی بخش‌ها</option>
          {AUDIT_AREAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <div className="zpa-row-flex">
          <div className="zpa-field zpa-grow"><label htmlFor="af">از تاریخ</label><input id="af" type="date" name="from" defaultValue={sp.from ?? ''} /></div>
          <div className="zpa-field zpa-grow"><label htmlFor="at">تا تاریخ</label><input id="at" type="date" name="to" defaultValue={sp.to ?? ''} /></div>
        </div>
        <div className="zpa-search"><input name="entity" dir="ltr" defaultValue={sp.entity ?? ''} placeholder="شناسه‌ی مورد (UUID)" maxLength={36} aria-label="شناسه" /><button className="zpa-btn" type="submit">اعمال فیلتر</button></div>
      </form>
      {rows.length === 0 ? <div className="zpa-panel"><EmptyState title="رکوردی پیدا نشد" hint="فیلترها را کم کنید." /></div> : (
        <ul className="zpa-list">
          {rows.map(r => {
            const meta = r.metadata && typeof r.metadata === 'object' && Object.keys(r.metadata as object).length > 0 ? JSON.stringify(r.metadata, null, 1) : null;
            return (
              <li key={r.id} className="zpa-item">
                <div className="zpa-item-top"><b className="zpa-ltr">{r.action}</b><span className="zpa-item-end">{faDate(r.createdAt)}</span></div>
                <div className="zpa-item-sub">
                  <span>{r.actorName ?? 'سیستم'}</span><span className="zpa-tag">{r.entityType}</span>
                  {r.entityId ? <Link className="zpa-ltr zpa-link" href={`/admin/audit?entity=${r.entityId}`}>{r.entityId.slice(0, 8)}…</Link> : null}
                </div>
                {meta ? <details><summary className="zpa-small">جزئیات</summary><pre className="zpa-ltr" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11, margin: '6px 0 0' }}>{meta}</pre></details> : null}
              </li>
            );
          })}
        </ul>
      )}
      <Pager base={base} page={page} total={total} size={AUDIT_PAGE} />
    </>
  );
}
