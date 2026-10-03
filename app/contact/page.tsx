import type { Metadata } from 'next';
import { PublicPage } from '../../components/seo/PublicPage';
export const metadata: Metadata = { title: 'تماس', description: 'راه‌های ارتباط با Digital Platform.', alternates: { canonical: '/contact' } };
export default function Contact(){return <PublicPage eyebrow="CONTACT" title="ارتباط با تیم" description="برای پشتیبانی، همکاری، API و درخواست‌های سازمانی از مسیرهای رسمی محصول استفاده کنید."><div className="public-card-grid"><article className="public-info-card"><h2>پشتیبانی</h2><p>تیکت و کانال‌های رسمی پشتیبانی در زمان راه‌اندازی نهایی اینجا معرفی می‌شوند.</p></article><article className="public-info-card"><h2>همکاری</h2><p>برای Provider، Agency و White-label مسیر اختصاصی در نظر گرفته می‌شود.</p></article></div></PublicPage>}
