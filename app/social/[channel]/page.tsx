import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicPage } from '../../../components/seo/PublicPage';
import { BreadcrumbJsonLd } from '../../../components/seo/BreadcrumbJsonLd';
import { publicEntities } from '../../../content/marketing/catalog';

const channels = ['instagram','telegram','tiktok','youtube','x'] as const;
export function generateStaticParams() { return channels.map((channel) => ({ channel })); }
export async function generateMetadata({ params }: { params: Promise<{ channel: string }> }): Promise<Metadata> { const { channel } = await params; if (!channels.includes(channel as never)) return {}; const title = channel === 'instagram' ? 'خدمات اینستاگرام' : `خدمات ${channel}`; return { title, description: `قابلیت‌ها و خدمات مرتبط با ${title} در Digital Platform.`, alternates: { canonical: `/social/${channel}` } }; }
export default async function ChannelPage({ params }: { params: Promise<{ channel: string }> }) { const { channel } = await params; if (!channels.includes(channel as never)) notFound(); const instagram = channel === 'instagram'; return <PublicPage eyebrow="SOCIAL" title={instagram ? 'خدمات اینستاگرام' : `خدمات ${channel}`} description={instagram ? publicEntities[0].description : 'این صفحه قابلیت‌ها، محدودیت‌ها و منابع مجاز مرتبط با این کانال را مستند خواهد کرد.'}><BreadcrumbJsonLd items={[{name:'خانه',path:'/'},{name:'شبکه‌های اجتماعی',path:'/social'},{name:channel,path:`/social/${channel}`}]}/><section className="public-info-card"><h2>قابلیت‌ها</h2><p>{instagram ? publicEntities[0].capabilities.join('، ') : 'قابلیت‌ها پس از اتصال منابع واقعی و تأیید پشتیبانی هر کانال منتشر می‌شوند.'}</p><h2>محدودیت‌ها</h2><p>هیچ قابلیت یا سرویس عمومی نباید برخلاف قوانین، API یا محدودیت‌های اعلام‌شده توسط پلتفرم مربوطه ارائه شود.</p></section></PublicPage>; }
