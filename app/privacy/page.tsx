import type { Metadata } from 'next';
import { PublicPage } from '../../components/seo/PublicPage';
export const metadata: Metadata = { title: 'حریم خصوصی', description: 'سیاست حریم خصوصی Digital Platform.', alternates: { canonical: '/privacy' }, robots: { index: false, follow: true } };
export default function Privacy(){return <PublicPage eyebrow="LEGAL" title="حریم خصوصی" description="سیاست نهایی باید انواع داده، هدف پردازش، نگهداری، اشتراک‌گذاری، حقوق کاربر و سازوکار حذف را به‌صورت دقیق مشخص کند."><div className="public-info-card"><h2>وضعیت سند</h2><p>این صفحه اسکلت اولیه است و پیش از عرضه عمومی باید تکمیل و بازبینی حقوقی شود.</p></div></PublicPage>}
