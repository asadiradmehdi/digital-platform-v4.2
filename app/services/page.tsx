import type { Metadata } from 'next';
import { AppShell } from '../../components/AppShell';
import { ShellAside } from '../../components/zp/ShellAside';
import { CategoryGrid } from '../../components/zp/CategoryGrid';
import { SecHead } from '../../components/zp/cards';
import { optionalViewer } from '../../server/account/page-context';
import { listCatalogWithPrices } from '../../server/account/overview';

export const metadata: Metadata = { title: 'خدمات دیجیتال', robots: { index: false, follow: false } };

export default async function ServicesPage() {
  const viewer = await optionalViewer();
  const catalog = await listCatalogWithPrices().catch(() => []);
  const live = new Set(catalog.filter(c => c.unitPriceMinor).map(c => c.productSlug));
  return (
    <AppShell title="همه‌ی خدمات" back="/dashboard" aside={viewer ? <ShellAside workspaceId={viewer.workspaceId} /> : undefined}>
      <main className="zp-screen">
        <SecHead title="دسته‌ها" note={`${new Intl.NumberFormat('fa-IR').format(catalog.length)} سرویس فعال`} />
        <CategoryGrid live={live} />
      </main>
    </AppShell>
  );
}
