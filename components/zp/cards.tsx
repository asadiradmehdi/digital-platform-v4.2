// Presentational building blocks shared by the app screens. No hooks: safe in server components.
import Link from 'next/link';
import { ZIcon } from './ZIcon';
import { Ornament, Tile } from './brand';
import { categoryMeta, KINDS, serviceKind } from '../../lib/catalog-ui';
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

export function OrderItem({ order }: { order: OrderCard }) {
  const stage = orderStage(order.status);
  const kind = KINDS[serviceKind(order.serviceSlug ?? '')];
  const cat = categoryMeta(order.productSlug ?? '');
  return (
    <Link href={`/orders/${order.id}`} className="zp-ord zp-press">
      <div className="r">
        <Tile icon={kind.icon} />
        <span className="t">
          <b>{orderTitle(order)}</b>
          <span>{cat ? `${cat.name} · ` : ''}{formatWhen(order.createdAt)}</span>
        </span>
        <span className={`zp-st${stage.tone === 'ok' ? ' ok' : stage.tone === 'bad' ? ' bad' : ''}`}>{stage.label}</span>
      </div>
      <div className="zp-pm">
        <div className={`zp-prog${stage.tone === 'ok' ? ' tq' : stage.tone === 'bad' ? ' bad' : ''}`}>
          <i style={{ transform: `scaleX(${Math.max(stage.steps, 0.15) / 4})` }} />
        </div>
        <span>{formatTomanNumber(toToman(order.totalMinor, order.currency))} تومان</span>
      </div>
    </Link>
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
