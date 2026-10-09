import { requireCurrentUser } from '../../../../server/identity/request-user';
import { listAdminServices } from '../../../../server/admin/catalog';
import { KINDS, isHiddenCategory, serviceKind } from '../../../../lib/catalog-ui';
import { EmptyState, PageHead, categoryName } from '../ui';
import { CatalogEditor, type GroupView } from './CatalogEditor';

export default async function CatalogPage() {
  const userId = await requireCurrentUser();
  const services = await listAdminServices(userId);
  const map = new Map<string, GroupView>();
  for (const s of services) {
    const kind = KINDS[serviceKind(s.slug)];
    const g = map.get(s.productSlug) ?? { slug: s.productSlug, name: categoryName(s.productSlug), hidden: isHiddenCategory(s.productSlug), items: [] };
    g.items.push({
      id: s.id, name: s.name, active: s.active, manual: s.fulfillmentMode === 'MANUAL', per: kind.per, unit: kind.unit,
      price: s.price ? { unitToman: s.price.unitToman, since: s.price.since, confirmed: s.price.confirmed } : null,
      previous: s.previous ? { unitToman: s.previous.unitToman } : null,
      draft: s.draft ? { id: s.draft.id, unitToman: s.draft.unitToman } : null,
      priceId: s.price?.id,
    });
    map.set(s.productSlug, g);
  }
  return (
    <>
      <PageHead title="خدمات و قیمت‌ها" hint="قیمت را بنویسید و «ثبت قیمت» را بزنید؛ قیمت قبلی در تاریخچه می‌ماند و با «بازگشت به قیمت قبلی» برمی‌گردد." />
      {services.length === 0 ? <div className="zpa-panel"><EmptyState title="خدمتی ثبت نشده" hint="ابتدا کاتالوگ را بارگذاری کنید." /></div> : <CatalogEditor groups={[...map.values()]} />}
    </>
  );
}
