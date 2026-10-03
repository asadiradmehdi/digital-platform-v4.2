import type { Metadata } from 'next';
import { PublicPage } from '../../components/seo/PublicPage';
export const metadata: Metadata = { title: 'شرایط استفاده', description: 'شرایط استفاده از Digital Platform.', alternates: { canonical: '/terms' }, robots: { index: false, follow: true } };
export default function Terms(){return <PublicPage eyebrow="LEGAL" title="شرایط استفاده" description="نسخه حقوقی نهایی باید پیش از عرضه عمومی، متناسب با حوزه فعالیت و قوانین محل ارائه سرویس تکمیل و بازبینی شود."><div className="public-info-card"><h2>وضعیت سند</h2><p>این صفحه فعلاً اسکلت محتوایی است و نباید به‌عنوان شرایط نهایی محصول تلقی شود.</p></div></PublicPage>}
