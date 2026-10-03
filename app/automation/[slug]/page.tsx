import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicPage } from '../../../components/seo/PublicPage';
import { EntityJsonLd } from '../../../components/seo/EntityJsonLd';
import { BreadcrumbJsonLd } from '../../../components/seo/BreadcrumbJsonLd';
import { getEntityBySlug, publicEntities } from '../../../content/marketing/catalog';

export function generateStaticParams() { return publicEntities.filter((x) => x.category === 'automation').map((x) => ({ slug: x.slug.replace('workflow-', '') })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entity = getEntityBySlug(`workflow-${slug}`);
  return entity ? { title: entity.title, description: entity.description, alternates: { canonical: entity.href } } : {};
}
export default async function AutomationEntity({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = getEntityBySlug(`workflow-${slug}`);
  if (!entity) return notFound();
  return <PublicPage eyebrow="AUTOMATION" title={entity.title} description={entity.description}>
    <EntityJsonLd entity={entity}/>
    <BreadcrumbJsonLd items={[{name:'خانه',path:'/'},{name:'اتوماسیون',path:'/automation'},{name:entity.title,path:entity.href}]}/>
    <section className="public-info-card"><h2>تعریف</h2><p>{entity.description}</p><h2>قابلیت‌ها</h2><ul>{entity.capabilities.map(x=><li key={x}>{x}</li>)}</ul><h2>نیازمندی‌ها</h2><ul>{entity.requirements.map(x=><li key={x}>{x}</li>)}</ul><h2>قیمت‌گذاری</h2><p>{entity.pricingModel}</p></section>
  </PublicPage>;
}
