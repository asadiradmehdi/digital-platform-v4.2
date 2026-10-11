import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/AppShell';
import { ShellAside } from '../../../components/zp/ShellAside';
import { Tile } from '../../../components/zp/brand';
import { EmptyState } from '../../../components/zp/cards';
import { SiteShell } from '../../../components/site/SiteShell';
import { Mixed, Breadcrumbs, CtaBand, FaqList, LdScript, PriceTable, SectionTitle, Steps, TrustStrip } from '../../../components/site/bits';
import { CATEGORIES, baseSlug, categoryMeta, variantOf, isHiddenCategory, perLabel, serviceBrand, serviceIcon, serviceMeta, shortServiceName, sortServices } from '../../../lib/catalog-ui';
import { formatTomanNumber } from '../../../lib/format';
import { categoryCopy, categoryFaq, fromPrice, isSocialCategory, servicesIn } from '../../../lib/seo/catalog-seo';
import { breadcrumbLd, faqLd, graph, organizationLd, serviceListLd, webPageLd } from '../../../lib/seo/jsonld';
import { metadataForPage, ogImage } from '../../../lib/seo/site';
import { optionalViewer } from '../../../server/account/page-context';
import { listCatalogWithPrices } from '../../../server/account/overview';
import { supportHours } from '../../../server/content/trust';
import { getPublicCatalog } from '../../../server/seo/public-catalog';
import { ServiceGrid, type ServiceCard } from './ServiceGrid';

type Params = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category } = await params;
  const cat = categoryMeta(category);
  const copy = categoryCopy(category);
  if (!cat || !copy || isHiddenCategory(cat.key)) return { title: 'صفحه پیدا نشد', robots: { index: false, follow: false } };
  const services = servicesIn(await getPublicCatalog(), cat.key);
  return metadataForPage({
    title: copy.title,
    description: copy.description,
    path: `/services/${cat.key}`,
    // A category with nothing on sale is a thin «به‌زودی» page: keep it out of the index until it has services.
    noIndex: services.length === 0,
    image: ogImage(`/og/${cat.key}.jpg`, copy.h1),
    keywords: copy.keywords,
  });
}

export default async function CategoryPage({ params }: Params) {
  const { category } = await params;
  const cat = categoryMeta(category);
  if (!cat || isHiddenCategory(cat.key)) notFound();
  const viewer = await optionalViewer();
  return viewer ? <MemberCategory catKey={cat.key} workspaceId={viewer.workspaceId} /> : <PublicCategory catKey={cat.key} />;
}

/** Signed-in customers: the compact app screen — every service on one grid, straight into ordering. */
async function MemberCategory({ catKey, workspaceId }: { catKey: string; workspaceId: string | null }) {
  const cat = categoryMeta(catKey)!;
  const items = (await listCatalogWithPrices(cat.key).catch(() => [])).filter(i => i.unitPriceMinor);
  const cards: ServiceCard[] = sortServices(items).map(it => {
    const kind = serviceMeta(it.slug);
    return {
      slug: it.slug,
      base: baseSlug(it.slug),
      variant: variantOf(it.slug).label,
      priceValue: Number(it.unitPriceMinor) * kind.per,
      name: shortServiceName(it.name, cat.name),
      icon: serviceIcon(it.slug),
      brand: serviceBrand(it.slug),
      perLabel: perLabel(kind),
      price: formatTomanNumber(Number(it.unitPriceMinor) * kind.per),
    };
  });
  return (
    <AppShell title={cat.name} back="/dashboard" aside={<ShellAside workspaceId={workspaceId} />}>
      <main className="zp-screen">
        <div className="zp-hero">
          <Tile icon={cat.icon} />
          <div>
            <h1>{cat.title ?? `خدمات ${cat.name}`}</h1>
            {items.length ? <>
              <p className="zp-hero-live"><i className="zp-live" aria-hidden />{new Intl.NumberFormat('fa-IR').format(items.length)} سرویس فعال</p>
              <p>{cat.note ?? 'قیمت شفاف، پرداخت از کیف پول'}</p>
            </> : <p>به‌زودی در زُحل پی</p>}
          </div>
        </div>
        {cards.length ? <ServiceGrid cards={cards} /> : (
          <EmptyState icon={cat.icon} title="به‌زودی" text={`خدمات ${cat.name} در حال آماده‌سازی است. تا آن موقع از دسته‌های فعال استفاده کنید.`} action={{ href: '/dashboard', label: 'بازگشت به خدمات' }} />
        )}
      </main>
    </AppShell>
  );
}

/** Visitors and crawlers: the indexable landing page for the category. */
async function PublicCategory({ catKey }: { catKey: string }) {
  const cat = categoryMeta(catKey)!;
  const copy = categoryCopy(cat.key)!;
  const catalog = await getPublicCatalog();
  const services = servicesIn(catalog, cat.key);
  const from = fromPrice(services, cat.key);
  const faq = categoryFaq(cat.key, services, supportHours());
  const path = `/services/${cat.key}`;
  const crumbs = [{ name: 'زُحل پی', path: '/' }, { name: 'خدمات', path: '/services' }, { name: cat.title ?? `خدمات ${cat.name}`, path }];
  const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
  const social = isSocialCategory(cat.key);
  const others = CATEGORIES.filter(c => c.key !== cat.key && catalog.some(s => s.category === c.key));

  if (!services.length) {
    return (
      <SiteShell catalog={catalog}>
        <Breadcrumbs items={crumbs} />
        <section className="zs-phero" aria-labelledby="cat-h1">
          <Tile icon={cat.icon} size={64} />
          <div className="t"><h1 id="cat-h1">{copy.h1}</h1><p className="lead"><Mixed text={copy.intro[0]} /></p></div>
        </section>
        <EmptyState icon={cat.icon} title="به‌زودی" text={`خدمات ${cat.name} در حال آماده‌سازی است. تا آن موقع از دسته‌های فعال زُحل پی استفاده کنید.`} action={{ href: '/services', label: 'همه‌ی خدمات' }} />
      </SiteShell>
    );
  }

  return (
    <SiteShell catalog={catalog}>
      <LdScript data={graph(
        organizationLd(),
        webPageLd({ path, name: copy.h1, description: copy.description, type: 'CollectionPage' }),
        breadcrumbLd(crumbs),
        serviceListLd(services),
        faqLd(faq),
      )} />
      <Breadcrumbs items={crumbs} />

      <section className="zs-phero" aria-labelledby="cat-h1">
        <Tile icon={cat.icon} size={64} />
        <div className="t">
          <h1 id="cat-h1">{copy.h1}</h1>
          <p className="lead"><Mixed text={copy.intro[0]} /></p>
          <p className="meta">
            <b>{fa(services.length)} سرویس فعال</b>
            {from && <> | شروع قیمت {from.perLabel} <b>{from.text} تومان</b></>}
          </p>
          <div className="acts">
            <a href="#prices" className="zp-cta zp-press">جدول قیمت‌ها</a>
            <Link href="/auth?mode=register" className="zs-ghost zp-press">ثبت‌نام و سفارش</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="prices">
        <SectionTitle id="prices" note="قیمت روز، به تومان">قیمت خدمات {cat.name}</SectionTitle>
        <PriceTable services={services} categoryName={cat.name} caption={`قیمت خدمات ${cat.name} در زُحل پی`} />
        <p className="zs-note">مبلغ هر سفارش دقیقاً «تعداد × قیمت واحد» است و پیش از پرداخت نمایش داده می‌شود. برای دیدن بسته‌ها و جزئیات، روی هر سرویس بزنید.</p>
      </section>

      <section aria-labelledby="how">
        <SectionTitle id="how">سفارش خدمات {cat.name} در ۴ قدم</SectionTitle>
        {copy.intro.slice(1).map(p => <p key={p} className="zs-p"><Mixed text={p} /></p>)}
        <Steps steps={[
          { t: 'سرویس را انتخاب کنید', d: 'از جدول قیمت بالا؛ قیمت هر واحد مشخص است.' },
          { t: social ? 'لینک یا نام کاربری' : cat.key === 'ai-subscriptions' ? 'ایمیل حساب' : 'اطلاعات سفارش', d: social ? 'رمز عبور حساب لازم نیست.' : cat.key === 'ai-subscriptions' ? 'اشتراک روی همین ایمیل فعال می‌شود.' : 'هر چه دقیق‌تر، نتیجه بهتر.' },
          { t: 'پرداخت از کیف پول', d: 'مبلغ کل پیش از پرداخت نمایش داده می‌شود.' },
          { t: 'پیگیری وضعیت', d: 'مرحله‌ی سفارش را در حساب‌تان می‌بینید.' },
        ]} />
      </section>

      <TrustStrip />

      <section aria-labelledby="faq-h">
        <SectionTitle id="faq-h">سؤالات متداول خدمات {cat.name}</SectionTitle>
        <FaqList faq={faq} />
      </section>

      {others.length > 0 && (
        <nav className="zs-chips" aria-label="دسته‌های دیگر">
          <h2>دسته‌های دیگر</h2>
          <ul>{others.map(c => <li key={c.key}><Link href={`/services/${c.key}`} className="zp-press"><Tile icon={c.icon} size={28} />{c.name}</Link></li>)}</ul>
        </nav>
      )}

      <CtaBand title={`شروع خرید خدمات ${cat.name}`} text="ثبت‌نام رایگان است؛ کیف پول را شارژ کنید و اولین سفارش را ثبت کنید." href="/auth?mode=register" label="ثبت‌نام رایگان" />
    </SiteShell>
  );
}
