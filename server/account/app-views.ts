// View models for the native app: the server owns pricing, stages, loyalty level and wording,
// so the mobile client only renders (no domain logic is duplicated in React Native).
import { CATEGORIES, categoryMeta, isHiddenCategory, isTeamFulfilled, orderForm, perLabel, serviceBrand, serviceIcon, serviceMeta, shortServiceName, sortServices } from '../../lib/catalog-ui';
import { formatQuantityWords, formatWhen, orderCode, toToman } from '../../lib/format';
import { orderStage } from '../../lib/order-progress';
import { tierFor } from '../../lib/tiers';
import type { CatalogItem, OrderCard, WalletEntry } from './overview';

export function catalogView(items: CatalogItem[]) {
  const priced = sortServices(items.filter(i => i.unitPriceMinor));
  const services = priced.map(i => {
    const kind = serviceMeta(i.slug);
    const form = orderForm(i.productSlug, i.slug);
    const min = i.minQuantity ? Number(i.minQuantity) : 1;
    const max = i.maxQuantity ? Number(i.maxQuantity) : Number.MAX_SAFE_INTEGER;
    const quantities = kind.quantities.filter(q => q >= min && q <= max);
    return {
      id: i.id, slug: i.slug, name: i.name, description: i.description, category: i.productSlug,
      short: shortServiceName(i.name, categoryMeta(i.productSlug)?.name ?? ''), brand: serviceBrand(i.slug) ?? null, perLabel: perLabel(kind),
      group: kind.group, unit: kind.unit, icon: serviceIcon(i.slug), per: kind.per,
      unitPriceToman: Number(i.unitPriceMinor),
      quantities: quantities.length ? quantities : [min],
      target: form.target, brief: form.brief, facts: form.facts, refund: form.refund,
    };
  });
  const categories = CATEGORIES.map(c => ({ ...c, live: services.some(s => s.category === c.key), count: services.filter(s => s.category === c.key).length }));
  return { categories, services };
}

export function orderCardView(o: OrderCard) {
  const cat = categoryMeta(o.productSlug ?? '');
  const q = Number(o.quantity ?? 0);
  return {
    id: o.id,
    code: orderCode(o.id),
    title: o.serviceName ? (q > 1 ? `${formatQuantityWords(q)} ${o.serviceName}` : o.serviceName) : `سفارش ${orderCode(o.id)}`,
    subtitle: `${cat ? `${cat.name} · ` : ''}${formatWhen(o.createdAt)}`,
    icon: serviceIcon(o.serviceSlug ?? ''),
    stage: orderStage(o.status, isTeamFulfilled(o.productSlug)),
    amountToman: toToman(o.totalMinor, o.currency),
    // Reorder link target; null for hidden sections or orders without a service.
    reorder: o.serviceSlug && !isHiddenCategory(o.productSlug) ? { service: o.serviceSlug, qty: o.quantity ? Number(o.quantity) : null } : null,
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
