import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicPage } from '../../../../components/seo/PublicPage';
import { EntityJsonLd } from '../../../../components/seo/EntityJsonLd';
import { BreadcrumbJsonLd } from '../../../../components/seo/BreadcrumbJsonLd';
import { getEntityBySlug, publicEntities } from '../../../../content/marketing/catalog';

export function generateStaticParams() {
  return publicEntities.map((entity) => ({ category: entity.category, slug: entity.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { category, slug } = await params;
  const entity = getEntityBySlug(slug, category);
  if (!entity) return {};
  return { title: entity.title, description: entity.description, alternates: { canonical: entity.href }, openGraph: { type: 'website', title: entity.title, description: entity.description, url: entity.href } };
}

export default async function EntityPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const entity = getEntityBySlug(slug, category);
  if (!entity) return notFound();
  return <PublicPage eyebrow={entity.category.toUpperCase()} title={entity.title} description={entity.description}>
    <EntityJsonLd entity={entity}/>
    <BreadcrumbJsonLd items={[{ name: 'خانه', path: '/' }, { name: entity.category, path: '/services' }, { name: entity.title, path: entity.href }]} />
    <section className="public-info-card">
      <h2>این سرویس برای چه کسانی است؟</h2><p>{entity.audience.join('، ')}</p>
      <h2>قابلیت‌ها</h2><ul>{entity.capabilities.map((item) => <li key={item}>{item}</li>)}</ul>
      <h2>نیازمندی‌ها</h2><ul>{entity.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
      <h2>مدل قیمت‌گذاری</h2><p>{entity.pricingModel}</p>
      <h2>محدودیت‌ها</h2><ul>{entity.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
      <p>آخرین بازبینی محتوا: <time dateTime={entity.updatedAt}>{entity.updatedAt}</time></p>
    </section>
  </PublicPage>;
}
