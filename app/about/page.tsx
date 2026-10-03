import type { Metadata } from 'next';
import { PublicPage } from '../../components/seo/PublicPage';
export const metadata: Metadata = { title: 'درباره ما', description: 'معرفی Digital Platform، معماری محصول و اصول ارائه خدمات.', alternates: { canonical: '/about' } };
export default function About(){return <PublicPage eyebrow="ABOUT" title="Digital Platform چیست؟" description="یک پلتفرم یکپارچه برای خدمات دیجیتال، AI، اتوماسیون و عملیات کسب‌وکار."><div className="public-info-card"><h2>اصول محصول</h2><p>شفافیت در قیمت و وضعیت، معماری ماژولار، امنیت، قابلیت ردیابی و طراحی فارسی‌محور از اصول پایه محصول هستند.</p></div></PublicPage>}
