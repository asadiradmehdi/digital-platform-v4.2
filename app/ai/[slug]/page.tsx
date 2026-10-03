import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicPage } from '../../../components/seo/PublicPage';
import { EntityJsonLd } from '../../../components/seo/EntityJsonLd';
import { BreadcrumbJsonLd } from '../../../components/seo/BreadcrumbJsonLd';
import { getEntityBySlug, publicEntities } from '../../../content/marketing/catalog';

export function generateStaticParams() { return publicEntities.filter((x) => x.category === 'ai').map((x) => ({ slug: x.slug.replace('ai-', '') })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const e = getEntityBySlug(`ai-${slug}`); return e ? { title: e.title, description: e.description, alternates: { canonical: e.href } } : {}; }
export default async function AIEntity({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const entity = getEntityBySlug(`ai-${slug}`); if (!entity) return notFound(); const resolved = entity; return <PublicPage eyebrow="AI" title={resolved.title} description={resolved.description}><EntityJsonLd entity={resolved}/><BreadcrumbJsonLd items={[{name:'خانه',path:'/'},{name:'AI',path:'/ai'},{name:resolved.title,path:resolved.href}]}/><section className="public-info-card"><h2>تعریف</h2><p>{resolved.description}</p><h2>مخاطب</h2><p>{resolved.audience.join('، ')}</p><h2>قابلیت‌ها</h2><ul>{resolved.capabilities.map(x=><li key={x}>{x}</li>)}</ul><h2>قیمت‌گذاری</h2><p>{resolved.pricingModel}</p><h2>محدودیت‌ها</h2><ul>{resolved.limitations.map(x=><li key={x}>{x}</li>)}</ul></section></PublicPage>; }
