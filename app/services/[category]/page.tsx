import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/AppShell';
import { ShellAside } from '../../../components/zp/ShellAside';
import { Tile } from '../../../components/zp/brand';
import { EmptyState } from '../../../components/zp/cards';
import { categoryMeta, perLabel, serviceBrand, serviceIcon, serviceMeta, shortServiceName, sortServices } from '../../../lib/catalog-ui';
import { formatTomanNumber } from '../../../lib/format';
import { optionalViewer } from '../../../server/account/page-context';
import { listCatalogWithPrices } from '../../../server/account/overview';
import { ServiceGrid, type ServiceCard } from './ServiceGrid';

export const metadata: Metadata = { title: 'خدمات', robots: { index: false, follow: false } };

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = categoryMeta(category);
  if (!cat) notFound();
  const viewer = await optionalViewer();
  const items = (await listCatalogWithPrices(cat.key).catch(() => [])).filter(i => i.unitPriceMinor);

  const cards: ServiceCard[] = sortServices(items).map(it => {
    const kind = serviceMeta(it.slug);
    return {
      slug: it.slug,
      name: shortServiceName(it.name, cat.name),
      icon: serviceIcon(it.slug),
      brand: serviceBrand(it.slug),
      perLabel: perLabel(kind),
      price: formatTomanNumber(Number(it.unitPriceMinor) * kind.per),
    };
  });

  return (
    <AppShell title={cat.name} back="/dashboard" aside={viewer ? <ShellAside workspaceId={viewer.workspaceId} /> : undefined}>
      <main className="zp-screen">
        <div className="zp-hero">
          <Tile icon={cat.icon} />
          <div>
            <h1>{cat.title ?? `خدمات ${cat.name}`}</h1>
            <p>{items.length ? <><b>{new Intl.NumberFormat('fa-IR').format(items.length)} سرویس فعال</b> · {cat.note ?? 'قیمت شفاف، پرداخت از کیف پول'}</> : 'به‌زودی در زُحل پی'}</p>
          </div>
        </div>
        {cards.length ? <ServiceGrid cards={cards} /> : (
          <EmptyState icon={cat.icon} title="به‌زودی" text={`خدمات ${cat.name} در حال آماده‌سازی است. تا آن موقع از دسته‌های فعال استفاده کنید.`} action={{ href: '/dashboard', label: 'بازگشت به خدمات' }} />
        )}
      </main>
    </AppShell>
  );
}
