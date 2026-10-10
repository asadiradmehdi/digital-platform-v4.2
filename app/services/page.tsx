import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { ShellAside } from '../../components/zp/ShellAside';
import { CategoryGrid } from '../../components/zp/CategoryGrid';
import { SecHead } from '../../components/zp/cards';
import { Tile } from '../../components/zp/brand';
import { SiteShell } from '../../components/site/SiteShell';
import { Breadcrumbs, CtaBand, LdScript, SectionTitle, ServiceLinkCard, TrustStrip } from '../../components/site/bits';
import { CATEGORIES } from '../../lib/catalog-ui';
import { categoryCopy, fromPrice, servicesIn } from '../../lib/seo/catalog-seo';
import { breadcrumbLd, graph, organizationLd, webPageLd } from '../../lib/seo/jsonld';
import { absoluteUrl, metadataForPage, ogImage } from '../../lib/seo/site';
import { optionalViewer } from '../../server/account/page-context';
import { listCatalogWithPrices } from '../../server/account/overview';
import { getPublicCatalog } from '../../server/seo/public-catalog';

const TITLE = 'همه‌ی خدمات و قیمت‌ها';
const DESCRIPTION = 'فهرست کامل خدمات زُحل پی با قیمت روز: خرید فالوور، لایک، بازدید و ممبر برای اینستاگرام، تلگرام، یوتیوب، تیک‌تاک، روبیکا، آپارات، بله و ایتا، و اشتراک هوش مصنوعی ChatGPT، Claude، Gemini و Midjourney.';

export const metadata: Metadata = metadataForPage({ title: TITLE, description: DESCRIPTION, path: '/services', image: ogImage('/og/services.jpg', 'خدمات زُحل پی') });

export default async function ServicesPage() {
  const viewer = await optionalViewer();
  if (viewer) {
    const catalog = await listCatalogWithPrices().catch(() => []);
    const live = new Set(catalog.filter(c => c.unitPriceMinor).map(c => c.productSlug));
    return (
      <AppShell title="همه‌ی خدمات" back="/dashboard" aside={<ShellAside workspaceId={viewer.workspaceId} />}>
        <main className="zp-screen">
          <SecHead title="دسته‌ها" note={`${new Intl.NumberFormat('fa-IR').format(catalog.length)} سرویس فعال`} />
          <CategoryGrid live={live} />
        </main>
      </AppShell>
    );
  }

  const catalog = await getPublicCatalog();
  const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
  const crumbs = [{ name: 'زُحل پی', path: '/' }, { name: 'خدمات', path: '/services' }];
  const live = CATEGORIES.filter(c => catalog.some(s => s.category === c.key));
  const soon = CATEGORIES.filter(c => !catalog.some(s => s.category === c.key));

  return (
    <SiteShell catalog={catalog}>
      <LdScript data={graph(
        organizationLd(),
        webPageLd({ path: '/services', name: TITLE, description: DESCRIPTION, type: 'CollectionPage' }),
        breadcrumbLd(crumbs),
        { '@type': 'ItemList', itemListElement: live.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(`/services/${c.key}`), name: categoryCopy(c.key)?.h1 ?? c.name })) },
      )} />
      <Breadcrumbs items={crumbs} />
      <section className="zs-phero" aria-labelledby="svc-index-h1">
        <Tile icon="grid" size={64} />
        <div className="t">
          <h1 id="svc-index-h1">خدمات زُحل پی و قیمت روز</h1>
          <p className="lead">{fa(catalog.length)} سرویس فعال در {fa(live.length)} دسته: خدمات رشد اینستاگرام، تلگرام، یوتیوب، تیک‌تاک، روبیکا، آپارات، بله و ایتا، و اشتراک ابزارهای هوش مصنوعی. قیمت همه‌ی سرویس‌ها پیش از پرداخت مشخص است.</p>
        </div>
      </section>

      {live.map(c => {
        const services = servicesIn(catalog, c.key);
        const from = fromPrice(services, c.key);
        return (
          <section key={c.key} aria-labelledby={`cat-${c.key}`}>
            <SectionTitle id={`cat-${c.key}`} note={<Link href={`/services/${c.key}`}>{from ? `از ${from.text} تومان | ` : ''}همه</Link>}>
              <Link href={`/services/${c.key}`}>{c.title ?? `خدمات ${c.name}`}</Link>
            </SectionTitle>
            <div className="zs-svcs">{services.slice(0, 8).map(s => <ServiceLinkCard key={s.slug} service={s} />)}</div>
          </section>
        );
      })}

      {soon.length > 0 && (
        <nav className="zs-chips" aria-label="به‌زودی">
          <h2>به‌زودی در زُحل پی</h2>
          <ul>{soon.map(c => <li key={c.key}><span className="zs-chip-soon"><Tile icon={c.icon} size={28} />{c.name}</span></li>)}</ul>
        </nav>
      )}

      <TrustStrip />
      <CtaBand title="ثبت‌نام رایگان در زُحل پی" text="کیف پول را شارژ کنید، سرویس را انتخاب کنید و سفارش را لحظه‌به‌لحظه پیگیری کنید." href="/auth?mode=register" label="ثبت‌نام رایگان" />
    </SiteShell>
  );
}
