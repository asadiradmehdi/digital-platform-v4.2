import type { Metadata } from 'next';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import ServicesCatalog from './ServicesCatalog';
import { listServices } from '../../server/commerce/catalog';
import type { CatalogService } from '../../server/commerce/catalog';

export const metadata: Metadata = { title: 'خدمات دیجیتال', robots: { index: false, follow: false } };

async function getDbServices(): Promise<CatalogService[] | null> {
  try {
    const page = await listServices(50);
    return page.items.length > 0 ? page.items : null;
  } catch {
    return null;
  }
}

export default async function ServicesPage() {
  const dbServices = await getDbServices();
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
        <ServicesCatalog dbServices={dbServices} />
      </main>
    </AppShell>
  );
}
