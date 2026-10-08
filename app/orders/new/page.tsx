import type { Metadata } from 'next';
import { AppShell } from '../../../components/AppShell';
import { ShellAside } from '../../../components/zp/ShellAside';
import { EmptyState } from '../../../components/zp/cards';
import { categoryMeta, KINDS, serviceBrand, serviceIcon, serviceKind, targetField } from '../../../lib/catalog-ui';
import { toToman } from '../../../lib/format';
import { requireViewer } from '../../../server/account/page-context';
import { getWalletSummary, listCatalogWithPrices } from '../../../server/account/overview';
import { PackagePicker } from './PackagePicker';

export const metadata: Metadata = { title: 'سفارش جدید', robots: { index: false, follow: false } };

export default async function OrderNewPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service: slug = '' } = await searchParams;
  const viewer = await requireViewer();
  const [catalog, wallet] = await Promise.all([
    listCatalogWithPrices().catch(() => []),
    viewer.workspaceId ? getWalletSummary(viewer.workspaceId, 1) : null,
  ]);
  const item = catalog.find(c => c.slug === slug && c.unitPriceMinor);
  const cat = item ? categoryMeta(item.productSlug) : undefined;

  if (!item) {
    return (
      <AppShell title="سفارش جدید" back="/dashboard" aside={<ShellAside workspaceId={viewer.workspaceId} />}>
        <main className="zp-screen">
          <EmptyState icon="box" title="سرویس پیدا نشد" text="این سرویس فعال نیست یا هنوز قیمت‌گذاری نشده است. از فهرست خدمات یک سرویس دیگر انتخاب کنید." action={{ href: '/services', label: 'مشاهده‌ی خدمات' }} />
        </main>
      </AppShell>
    );
  }

  const kindKey = serviceKind(item.slug);
  const kind = KINDS[kindKey];
  const min = item.minQuantity ? Number(item.minQuantity) : 1;
  const max = item.maxQuantity ? Number(item.maxQuantity) : Number.MAX_SAFE_INTEGER;
  const quantities = kind.quantities.filter(q => q >= min && q <= max);

  return (
    <AppShell title={item.name} back={cat ? `/services/${cat.key}` : '/services'} aside={<ShellAside workspaceId={viewer.workspaceId} />}>
      <main className="zp-screen">
        <PackagePicker
          workspaceId={viewer.workspaceId}
          walletToman={wallet ? toToman(wallet.balanceMinor, wallet.currency) : null}
          service={{
            id: item.id, slug: item.slug, name: item.name, note: item.description ?? (cat ? `خدمات ${cat.name}` : ''),
            icon: serviceIcon(item.slug), brand: serviceBrand(item.slug), unit: kind.unit, unitPriceToman: Number(item.unitPriceMinor),
            quantities: quantities.length ? quantities : [min],
            target: targetField(item.productSlug, kindKey, item.slug),
          }}
        />
      </main>
    </AppShell>
  );
}
