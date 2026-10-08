import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '../../../../components/AppShell';
import { ShellAside } from '../../../../components/zp/ShellAside';
import { ZIcon } from '../../../../components/zp/ZIcon';
import { SiteShell } from '../../../../components/site/SiteShell';
import { Mixed, Breadcrumbs, CtaBand, Facts, FaqList, LdScript, PackageTable, SectionTitle, ServiceLinkCard, ServiceTile, Steps } from '../../../../components/site/bits';
import { categoryMeta, KINDS } from '../../../../lib/catalog-ui';
import { findService, listPrice, orderHref, packageQuantities, relatedServices, serviceCopy, serviceHref } from '../../../../lib/seo/catalog-seo';
import { breadcrumbLd, faqLd, graph, organizationLd, serviceProductLd, webPageLd } from '../../../../lib/seo/jsonld';
import { metadataForPage, ogImage } from '../../../../lib/seo/site';
import { optionalViewer } from '../../../../server/account/page-context';
import { supportHours } from '../../../../server/content/trust';
import { getPublicCatalog } from '../../../../server/seo/public-catalog';

type Params = { params: Promise<{ category: string; slug: string }> };

async function resolve(category: string, segment: string) {
  const cat = categoryMeta(category);
  if (!cat) return null;
  const catalog = await getPublicCatalog();
  const service = findService(catalog, cat.key, segment);
  return service ? { cat, catalog, service } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category, slug } = await params;
  const hit = await resolve(category, slug);
  if (!hit) return { title: 'صفحه پیدا نشد', robots: { index: false, follow: false } };
  const copy = serviceCopy(hit.service, supportHours());
  return metadataForPage({
    title: copy.title,
    description: copy.description,
    path: serviceHref(hit.service),
    image: ogImage(`/og/${hit.cat.key}.jpg`, copy.h1),
    keywords: copy.keywords,
  });
}

export default async function ServicePage({ params }: Params) {
  const { category, slug } = await params;
  const hit = await resolve(category, slug);
  if (!hit) notFound();
  const { cat, catalog, service } = hit;
  const viewer = await optionalViewer();
  const signedIn = Boolean(viewer);
  const copy = serviceCopy(service, supportHours());
  const lp = listPrice(service);
  const unit = KINDS[lp.kind].unit;
  const order = orderHref(service.slug, signedIn);
  const path = serviceHref(service);
  const crumbs = [
    { name: 'زُحل پی', path: '/' },
    { name: 'خدمات', path: '/services' },
    { name: cat.title ?? `خدمات ${cat.name}`, path: `/services/${cat.key}` },
    { name: service.name, path },
  ];
  const related = relatedServices(catalog, service);

  const body: ReactNode = (
    <>
      <LdScript data={graph(
        organizationLd(),
        webPageLd({ path, name: copy.h1, description: copy.description, type: 'ItemPage' }),
        breadcrumbLd(crumbs),
        serviceProductLd(service, { description: copy.description, categoryName: cat.name, image: `/og/${cat.key}.jpg` }),
        faqLd(copy.faq),
      )} />
      <Breadcrumbs items={crumbs} />

      <section className="zs-phero" aria-labelledby="svc-h1">
        <ServiceTile slug={service.slug} size={64} />
        <div className="t">
          <h1 id="svc-h1">{copy.h1}</h1>
          <p className="lead"><Mixed text={copy.intro[0]} /></p>
          <p className="zs-price"><span>{lp.perLabel}</span><b>{lp.text}</b><i>تومان</i></p>
          <div className="acts">
            <Link href={order} className="zp-cta zp-press" rel={signedIn ? undefined : 'nofollow'}>{signedIn ? 'ثبت سفارش' : 'ثبت‌نام و سفارش'}<ZIcon name="chevL" /></Link>
            <a href="#packages" className="zs-ghost zp-press">بسته‌ها و قیمت‌ها</a>
          </div>
        </div>
      </section>

      <Facts facts={copy.facts} title={`مشخصات ${service.name}`} />

      <section aria-labelledby="packages">
        <SectionTitle id="packages" note="قیمت کل = تعداد × قیمت واحد">قیمت بسته‌های {service.name}</SectionTitle>
        <PackageTable service={service} quantities={packageQuantities(service)} unit={unit} orderHref={order} />
        <p className="zs-note">تعداد دلخواه بین حداقل و حداکثر را هم می‌توانید در فرم سفارش وارد کنید. قیمت در لحظه‌ی ثبت سفارش ثابت می‌شود.</p>
      </section>

      <section aria-labelledby="about-svc">
        <SectionTitle id="about-svc">{copy.h1} چطور انجام می‌شود؟</SectionTitle>
        {copy.intro.slice(1).map(p => <p key={p} className="zs-p"><Mixed text={p} /></p>)}
        <Steps steps={copy.steps} />
      </section>

      <section aria-labelledby="faq-h">
        <SectionTitle id="faq-h">سؤالات متداول {service.name}</SectionTitle>
        <FaqList faq={copy.faq} />
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related">
          <SectionTitle id="related" note={<Link href={`/services/${cat.key}`}>همه‌ی خدمات {cat.name}</Link>}>خدمات مرتبط</SectionTitle>
          <div className="zs-svcs">{related.map(r => <ServiceLinkCard key={r.slug} service={r} showCategory={r.category !== cat.key} />)}</div>
        </section>
      )}

      <CtaBand title={copy.h1} text={`${lp.perLabel} ${lp.text} تومان؛ مبلغ کل پیش از پرداخت نمایش داده می‌شود.`} href={order} label={signedIn ? 'ثبت سفارش' : 'ثبت‌نام و سفارش'} />

      <div className="zs-buybar" aria-hidden="true">
        <span><small>{lp.perLabel}</small><b>{lp.text} <i>تومان</i></b></span>
        <Link href={order} className="zp-cta zp-press" tabIndex={-1} rel={signedIn ? undefined : 'nofollow'}>{signedIn ? 'سفارش' : 'ثبت‌نام و سفارش'}</Link>
      </div>
    </>
  );

  if (viewer) {
    return (
      <AppShell title={service.name} back={`/services/${cat.key}`} aside={<ShellAside workspaceId={viewer.workspaceId} />}>
        <main className="zp-screen zs-inapp">{body}</main>
      </AppShell>
    );
  }
  return <SiteShell catalog={catalog}>{body}</SiteShell>;
}
