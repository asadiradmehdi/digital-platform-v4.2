// View models for the native app: the server owns pricing, stages, loyalty level and wording,
// so the mobile client only renders (no domain logic is duplicated in React Native).
import { CATEGORIES, categoryMeta, KINDS, serviceKind, targetField } from '../../lib/catalog-ui';
import { formatQuantityWords, formatWhen, orderCode, toToman } from '../../lib/format';
import { orderStage } from '../../lib/order-progress';
import { tierFor } from '../../lib/tiers';
import type { CatalogItem, OrderCard, WalletEntry } from './overview';

export function catalogView(items: CatalogItem[]) {
  const priced = items.filter(i => i.unitPriceMinor);
  const services = priced.map(i => {
    const kindKey = serviceKind(i.slug);
    const kind = KINDS[kindKey];
    const min = i.minQuantity ? Number(i.minQuantity) : 1;
    const max = i.maxQuantity ? Number(i.maxQuantity) : Number.MAX_SAFE_INTEGER;
    const quantities = kind.quantities.filter(q => q >= min && q <= max);
    return {
      id: i.id, slug: i.slug, name: i.name, description: i.description, category: i.productSlug,
      group: kind.group, unit: kind.unit, icon: kind.icon, per: kind.per,
      unitPriceToman: Number(i.unitPriceMinor),
      quantities: quantities.length ? quantities : [min],
      target: targetField(i.productSlug, kindKey),
    };
  });
  const categories = CATEGORIES.map(c => ({ ...c, live: services.some(s => s.category === c.key), count: services.filter(s => s.category === c.key).length }));
  return { categories, services };
}

export function orderCardView(o: OrderCard) {
  const kind = KINDS[serviceKind(o.serviceSlug ?? '')];
  const cat = categoryMeta(o.productSlug ?? '');
  const q = Number(o.quantity ?? 0);
  return {
    id: o.id,
    code: orderCode(o.id),
    title: o.serviceName ? (q > 1 ? `${formatQuantityWords(q)} ${o.serviceName}` : o.serviceName) : `سفارش ${orderCode(o.id)}`,
    subtitle: `${cat ? `${cat.name} · ` : ''}${formatWhen(o.createdAt)}`,
    icon: kind.icon,
    stage: orderStage(o.status),
    amountToman: toToman(o.totalMinor, o.currency),
  };
}

const TX_TITLE: Record<string, string> = {
  TOPUP: 'شارژ کیف پول', DEPOSIT: 'شارژ کیف پول', SERVICE_CHARGE: 'پرداخت سفارش',
  REFUND: 'بازگشت وجه', CANCELLATION_REFUND: 'بازگشت وجه سفارش لغوشده', SUBSCRIPTION: 'پرداخت اشتراک',
};

export function walletEntryView(e: WalletEntry) {
  const credit = e.direction === 'CREDIT';
  return {
    id: e.id,
    title: TX_TITLE[e.referenceType] ?? e.label ?? (credit ? 'واریز' : 'برداشت'),
    when: formatWhen(e.createdAt),
    amountToman: toToman(e.amountMinor, e.currency),
    credit,
    icon: credit ? (e.referenceType.includes('REFUND') ? 'gift' : 'arrowIn') : 'box',
  };
}

export function tierView(spentToman: number) {
  const t = tierFor(spentToman);
  return { name: t.tier.name, level: t.level, levels: t.levels, next: t.next?.name ?? null, progress: t.progress };
}
