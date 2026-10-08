import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/AppShell';
import { ShellAside } from '../../../components/zp/ShellAside';
import { Tile } from '../../../components/zp/brand';
import { EmptyState } from '../../../components/zp/cards';
import { categoryMeta, KINDS, serviceKind } from '../../../lib/catalog-ui';
import { formatQuantityWords, formatTomanNumber } from '../../../lib/format';
import { optionalViewer } from '../../../server/account/page-context';
import { listCatalogWithPrices } from '../../../server/account/overview';
import { CategoryRows, type CategoryGroup } from './CategoryRows';

export const metadata: Metadata = { title: 'خدمات', robots: { index: false, follow: false } };

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = categoryMeta(category);
  if (!cat) notFound();
  const viewer = await optionalViewer();
  const items = (await listCatalogWithPrices(cat.key).catch(() => [])).filter(i => i.unitPriceMinor);

  const groups: CategoryGroup[] = [];
  for (const it of items) {
    const kind = KINDS[serviceKind(it.slug)];
    let g = groups.find(x => x.label === kind.group);
    if (!g) groups.push(g = { label: kind.group, rows: [] });
    g.rows.push({
      slug: it.slug,
      name: it.name,
      note: it.description ?? 'ثبت آنی · پیگیری لحظه‌ای',
      icon: kind.icon,
      perLabel: kind.per > 1 ? `هر ${formatQuantityWords(kind.per)} ${kind.unit}` : `هر ${kind.unit}`,
      price: formatTomanNumber(Number(it.unitPriceMinor) * kind.per),
    });
  }

  const ORDER = ['فالوور', 'ممبر', 'لایک', 'بازدید', 'کامنت'];
  const rank = (l: string) => (ORDER.indexOf(l) + 1) || 99;
  groups.sort((a, b) => rank(a.label) - rank(b.label));

  return (
    <AppShell title={cat.name} back="/dashboard" aside={viewer ? <ShellAside workspaceId={viewer.workspaceId} /> : undefined}>
      <main className="zp-screen">
        <div className="zp-hero">
          <Tile icon={cat.icon} />
          <div>
            <h1>خدمات {cat.name}</h1>
            <p>{items.length ? <><b>{new Intl.NumberFormat('fa-IR').format(items.length)} سرویس فعال</b> · قیمت شفاف، پرداخت از کیف پول</> : 'به‌زودی در زُحل پی'}</p>
          </div>
        </div>
        {groups.length ? <CategoryRows groups={groups} /> : (
          <EmptyState icon={cat.icon} title="به‌زودی" text={`خدمات ${cat.name} در حال آماده‌سازی است. تا آن موقع از دسته‌های فعال استفاده کنید.`} action={{ href: '/dashboard', label: 'بازگشت به خدمات' }} />
        )}
      </main>
    </AppShell>
  );
}
