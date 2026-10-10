import '../../../components/zp/help.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '../../../components/AppShell';
import { BrandTile, Tile } from '../../../components/zp/brand';
import { ZIcon } from '../../../components/zp/ZIcon';
import { ShellAside } from '../../../components/zp/ShellAside';
import { baseSlug, categoryMeta, perLabel, serviceBrand, serviceIcon, serviceMeta, shortServiceName, sortServices, variantOf } from '../../../lib/catalog-ui';
import { formatTomanNumber } from '../../../lib/format';
import { listCatalogWithPrices } from '../../../server/account/overview';
import { optionalViewer } from '../../../server/account/page-context';

export const metadata: Metadata = { title: 'انتخاب نوع خدمت', robots: { index: false, follow: false } };
type Params = { params: Promise<{ base: string }> };

/** Second order step for signed-in customers: the variants of one offer (ایرانی / خارجی / اقتصادی …). */
export default async function ChoosePage({ params }: Params) {
  const { base } = await params;
  const viewer = await optionalViewer();
  if (!viewer) redirect(`/auth?next=/choose/${encodeURIComponent(base)}`);
  const items = sortServices((await listCatalogWithPrices().catch(() => [])).filter(i => i.unitPriceMinor && baseSlug(i.slug) === base));
  if (!items.length) notFound();
  if (items.length === 1) redirect(`/orders/new?service=${encodeURIComponent(items[0].slug)}`);
  const first = items[0];
  const cat = categoryMeta(first.productSlug);
  const brand = serviceBrand(first.slug);
  const kind = serviceMeta(first.slug);
  const name = shortServiceName(first.name, cat?.name ?? '').replace(` ${variantOf(first.slug).label}`, '').trim();
  return (
    <AppShell title={name} back={cat ? `/services/${cat.key}` : '/services'} aside={<ShellAside workspaceId={viewer.workspaceId} />}>
      <main className="zp-screen">
        <div className="zp-hero">
          {brand ? <BrandTile brand={brand} /> : <Tile icon={serviceIcon(first.slug)} />}
          <div><h1>{name}</h1><p>کدام نوع را می‌خواهید؟</p></div>
        </div>
        <div className="zp-search-list" role="list">
          {items.map(it => {
            const v = variantOf(it.slug);
            return (
              <Link key={it.slug} role="listitem" href={`/orders/new?service=${encodeURIComponent(it.slug)}`} className="zp-srow zp-press" aria-label={`${v.label}، ${perLabel(kind)} ${formatTomanNumber(Number(it.unitPriceMinor) * kind.per)} تومان`}>
                <span className="tx"><b>{v.label}</b><small>{v.hint}</small></span>
                <span className="pr"><b>{formatTomanNumber(Number(it.unitPriceMinor) * kind.per)}</b><small>تومان | {perLabel(kind)}</small></span>
                <ZIcon name="chevL" className="zp-chev" />
              </Link>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
