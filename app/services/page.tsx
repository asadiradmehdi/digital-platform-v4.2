import type { Metadata } from 'next';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import ServicesCatalog from './ServicesCatalog';
export const metadata: Metadata = { title: 'خدمات دیجیتال', robots: { index: false, follow: false } };
export default function ServicesPage() {
  return (
    <AppShell>
      <main className="services-page">
        <header className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <span className="eyebrow">خدمات · کاتالوگ</span>
            <h1>خدمات دیجیتال</h1>
            <p>خدمات شبکه‌های اجتماعی، هوش مصنوعی و اتوماسیون با قیمت شفاف و پیگیری لحظه‌ای.</p>
          </div>
        </header>
        <SystemStrip/>
        <ServicesCatalog/>
      </main>
    </AppShell>
  );
}
