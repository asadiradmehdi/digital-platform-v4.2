import { requireCurrentUser } from '../../../../server/identity/request-user';
import { listAdminServices } from '../../../../server/admin/catalog';
import { KINDS, serviceKind } from '../../../../lib/catalog-ui';
import { EmptyState, HiddenFlag, PageHead, categoryName, fa } from '../ui';
import { ServiceRow } from './ServiceRow';

export default async function CatalogPage() {
  const userId = await requireCurrentUser();
  const services = await listAdminServices(userId);
  const groups = new Map<string, typeof services>();
  for (const s of services) groups.set(s.productSlug, [...(groups.get(s.productSlug) ?? []), s]);
  const unconfirmed = services.filter(s => s.price && !s.price.confirmed).length;
  const drafts = services.filter(s => s.draft).length;

  return (
    <>
      <PageHead title="خدمات و قیمت‌ها" hint="قیمت قبلی هیچ‌وقت تغییر نمی‌کند؛ قیمت جدید به‌صورت پیش‌نویس ثبت می‌شود و بعد از تأیید جای قیمت فعلی را می‌گیرد.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={`zpa-tag ${unconfirmed ? 'warn' : 'ok'}`}>{fa(unconfirmed)} قیمت تأیید نشده</span>
          <span className={`zpa-tag ${drafts ? 'info' : ''}`}>{fa(drafts)} پیش‌نویس در انتظار</span>
        </div>
      </PageHead>
      {services.length === 0 ? <div className="zpa-panel"><EmptyState title="خدمتی ثبت نشده" hint="ابتدا کاتالوگ را بارگذاری کنید." /></div> : (
        [...groups.entries()].map(([slug, items]) => (
          <section className="zpa-sec" key={slug}>
            <h2>{categoryName(slug)}<HiddenFlag slug={slug} /></h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {items.map(s => {
                const kind = KINDS[serviceKind(s.slug)];
                return (
                  <ServiceRow key={s.id} serviceId={s.id} name={s.name} active={s.active} manual={s.fulfillmentMode === 'MANUAL'}
                    per={kind.per} unit={kind.unit} price={s.price} draft={s.draft} />
                );
              })}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
