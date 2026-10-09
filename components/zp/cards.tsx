// Presentational building blocks shared by the app screens. No hooks: safe in server components.
import Link from 'next/link';
import { ZIcon } from './ZIcon';
import { Ornament, Tile } from './brand';
import { categoryMeta, isHiddenCategory, isTeamFulfilled, serviceIcon } from '../../lib/catalog-ui';
import { formatQuantityWords, formatTomanNumber, formatWhen, orderCode, toToman } from '../../lib/format';
import { orderStage } from '../../lib/order-progress';
import type { OrderCard } from '../../server/account/overview';

export function WalletCard({ balanceToman, tierName, short, tail }: { balanceToman: number | null; tierName: string; short?: boolean; tail?: string }) {
  return (
    <div className="zp-card">
      <Ornament id={short ? 'card-orn-s' : 'card-orn'} w={400} h={240} cx={40} cy={250} rot={14} alpha={0.55} />
      <div className="hd"><b>زُحل <span className="zp-gtext">پی</span></b><span className="chip" /></div>
      <div className="bl">
        <span>موجودی کیف پول</span>
        <b>{balanceToman == null ? '—' : formatTomanNumber(balanceToman)}<small>تومان</small></b>
      </div>
      <div className="ft">
        <span className="zp-tier">سطح {tierName}</span>
        {short
          ? <Link href="/wallet" className="zp-cta zp-press" style={{ padding: '8px 14px' }}>افزایش</Link>
          : tail && <span className="zp-ltr" style={{ letterSpacing: '.22em', color: 'rgba(255,255,255,.75)' }}>•••• {tail}</span>}
      </div>
    </div>
  );
}

export function orderTitle(o: Pick<OrderCard, 'serviceName' | 'quantity' | 'id'>) {
  if (!o.serviceName) return `سفارش ${orderCode(o.id)}`;
  const q = Number(o.quantity ?? 0);
  return q > 1 ? `${formatQuantityWords(q)} ${o.serviceName}` : o.serviceName;
}

/** Reorder link: same service and package, opened on the order form for a fresh payment. */
export function reorderHref(o: { serviceSlug: string | null; quantity: string | null }, target?: string | null) {
  const q = new URLSearchParams({ service: o.serviceSlug ?? '' });
  if (o.quantity) q.set('qty', String(Number(o.quantity)));
  if (target) q.set('target', target.slice(0, 500));
  return `/orders/new?${q}`;
}

export function OrderItem({ order }: { order: OrderCard }) {
  const stage = orderStage(order.status, isTeamFulfilled(order.productSlug));
  const icon = serviceIcon(order.serviceSlug ?? '');
  const cat = categoryMeta(order.productSlug ?? '');
  return (
    <div className="zp-ord">
      <Link href={`/orders/${order.id}`} className="r zp-press">
        <Tile icon={icon} />
        <span className="t">
          <b>{orderTitle(order)}</b>
          <span>{cat ? `${cat.name} · ` : ''}{formatWhen(order.createdAt)}</span>
        </span>
        <span className={`zp-st${stage.tone === 'ok' ? ' ok' : stage.tone === 'bad' ? ' bad' : ''}`}>{stage.label}</span>
      </Link>
      <div className="zp-pm">
        <div className={`zp-prog${stage.tone === 'ok' ? ' tq' : stage.tone === 'bad' ? ' bad' : ''}`}>
          <i style={{ transform: `scaleX(${Math.max(stage.steps, 0.15) / 4})` }} />
        </div>
        <span>{formatTomanNumber(toToman(order.totalMinor, order.currency))} تومان</span>
        {order.serviceSlug && !isHiddenCategory(order.productSlug) && (
          <Link href={reorderHref(order)} className="zp-again zp-press" aria-label={`سفارش دوباره‌ی ${orderTitle(order)}`}>سفارش دوباره</Link>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: Parameters<typeof Tile>[0]['icon']; title: string; text: string; action?: { href: string; label: string } }) {
  return (
    <div className="zp-empty">
      <Tile icon={icon} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <Link href={action.href} className="zp-cta zp-press">{action.label}</Link>}
    </div>
  );
}

export function SecHead({ title, note, href, linkLabel }: { title: string; note?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="zp-sec">
      <h2>{title}</h2>
      {href ? <Link href={href}>{linkLabel}</Link> : note ? <span>{note}</span> : null}
    </div>
  );
}

export { ZIcon };
