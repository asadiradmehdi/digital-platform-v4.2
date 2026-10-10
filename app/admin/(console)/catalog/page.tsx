import Link from 'next/link';
import { requireCurrentUser } from '../../../../server/identity/request-user';
import { listAdminServices } from '../../../../server/admin/catalog';
import { getCatalogSummaries } from '../../../../server/admin/packages';
import { isHiddenCategory, perLabel, serviceMeta } from '../../../../lib/catalog-ui';
import { EmptyState, PageHead, categoryName, fa, toman } from '../ui';
import { ApproveDrafts, BulkTool, CategorySwitch } from './CategoryTools';

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const userId = await requireCurrentUser();
  const q = ((await searchParams).q ?? '').trim().slice(0, 60);
  const [services, summaries] = await Promise.all([listAdminServices(userId), getCatalogSummaries(userId)]);
  const shown = q ? services.filter(s => s.name.includes(q) || s.slug.includes(q.toLowerCase()) || categoryName(s.productSlug).includes(q)) : services;
  const groups = new Map<string, typeof services>();
  for (const s of shown) groups.set(s.productSlug, [...(groups.get(s.productSlug) ?? []), s]);
  const allDrafts = services.filter(s => s.draft).length;

  return (
    <>
      <PageHead title="خدمات و قیمت‌ها" hint="روی هر خدمت بزنید تا قیمت تک‌تک بسته‌ها را جدا ببینید و ویرایش کنید. هر تغییر در تاریخچه می‌ماند و قابل برگشت است." />
      <form method="get" action="/admin/catalog" className="zpa-filters" role="search">
        <div className="zpa-search">
          <input type="search" name="q" defaultValue={q} placeholder="جست‌وجوی خدمت یا دسته، مثلاً «چت‌جی‌پی‌تی»" maxLength={60} aria-label="جست‌وجوی خدمت" />
          <button className="zpa-btn" type="submit">جست‌وجو</button>
        </div>
      </form>
      {allDrafts > 0 ? <div className="zpa-panel zpa-row-flex" style={{ marginBottom: 16 }}><span className="zpa-grow">{fa(allDrafts)} پیش‌نویس قیمت منتظر تأیید است.</span><ApproveDrafts slug={null} label="همه‌ی دسته‌ها" count={allDrafts} /></div> : null}
      {services.length === 0 ? <div className="zpa-panel"><EmptyState title="خدمتی ثبت نشده" hint="ابتدا کاتالوگ را بارگذاری کنید." /></div>
        : groups.size === 0 ? <div className="zpa-panel"><EmptyState title="خدمتی پیدا نشد" hint="عبارت دیگری را امتحان کنید." /></div>
        : [...groups.entries()].map(([slug, items]) => {
          const drafts = items.filter(i => i.draft).length;
          const catActive = items[0].productActive;
          return (
            <section key={slug} className="zpa-sec" aria-labelledby={`c-${slug}`}>
              <h2 id={`c-${slug}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {categoryName(slug)} <span className="zpa-tag">{fa(items.length)} خدمت</span>
                {isHiddenCategory(slug) ? <span className="zpa-tag warn" title="در کد برنامه از مشتری پنهان است">پنهان از مشتری (تنظیم کد)</span> : null}
                {!catActive ? <span className="zpa-tag bad">خاموش</span> : null}
              </h2>
              <div className="zpa-row-flex" style={{ marginBottom: 10 }}>
                <BulkTool slug={slug} name={categoryName(slug)} />
                {!isHiddenCategory(slug) ? <CategorySwitch slug={slug} name={categoryName(slug)} active={catActive} /> : null}
                {drafts ? <ApproveDrafts slug={slug} label={`«${categoryName(slug)}»`} count={drafts} /> : null}
              </div>
              <ul className="zpa-list">
                {items.map(s => {
                  const sum = summaries.get(s.id);
                  const kind = serviceMeta(s.slug);
                  return (
                    <li key={s.id}>
                      <Link className="zpa-item" href={`/admin/catalog/${s.id}`}>
                        <div className="zpa-item-top">
                          <b>{s.name}</b>
                          <span className="zpa-item-end">{s.price ? toman(s.price.unitToman * kind.per) : '—'}</span>
                        </div>
                        <div className="zpa-item-sub">
                          <span>{s.price ? perLabel(kind) : 'قیمت‌گذاری نشده'}</span>
                          {!s.active ? <span className="zpa-tag warn">غیرفعال</span> : null}
                          {s.fulfillmentMode === 'MANUAL' ? <span className="zpa-tag info">انجام دستی</span> : null}
                          {sum && sum.pinnedCount > 0 ? <span className="zpa-tag info">{fa(sum.pinnedCount)} بسته با قیمت جدا</span> : null}
                          {s.draft ? <span className="zpa-tag info">پیش‌نویس</span> : null}
                          {s.price && !s.price.confirmed ? <span className="zpa-tag warn">تأیید نشده</span> : null}
                          {!s.price ? <span className="zpa-tag bad">بدون قیمت</span> : null}
                          {sum && sum.minMarginPct !== null && sum.minMarginPct < 10 ? <span className="zpa-tag bad">حاشیه‌ی سود کم ({fa(sum.minMarginPct)}٪)</span> : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
    </>
  );
}
