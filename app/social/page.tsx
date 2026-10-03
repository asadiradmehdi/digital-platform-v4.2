import type { Metadata } from 'next';
import { PublicPage } from '../../components/seo/PublicPage';
export const metadata: Metadata = { title: 'خدمات شبکه‌های اجتماعی', description: 'زیرساخت خدمات و ابزارهای شبکه‌های اجتماعی برای اینستاگرام، تلگرام، تیک‌تاک، یوتیوب و X.', alternates: { canonical: '/social' } };
const channels=[['اینستاگرام','Instagram'],['تلگرام','Telegram'],['تیک‌تاک','TikTok'],['یوتیوب','YouTube'],['ایکس','X']];
export default function Social(){return <PublicPage eyebrow="خدمات شبکه‌های اجتماعی" title="همه کانال‌ها، یک تجربه یکپارچه" description="برای هر شبکه یک لایه مستقل داریم تا قیمت، کیفیت، وضعیت سفارش و محدودیت‌ها شفاف و قابل ردیابی بمانند."><div className="public-card-grid">{channels.map(([fa,key])=><article className="public-info-card" key={key}><h2>{fa}</h2><p>سرویس‌ها و قابلیت‌های این کانال پس از اتصال منابع واقعی، بر اساس پشتیبانی و سیاست‌های همان پلتفرم فعال می‌شوند.</p></article>)}</div></PublicPage>}
