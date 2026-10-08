import Link from 'next/link';
import { BrandTile, Tile } from '../../../components/zp/brand';
import type { IconName } from '../../../components/zp/ZIcon';
import type { BrandLogo } from '../../../packages/design-tokens/src/brand-logos';

export type ServiceCard = { slug: string; name: string; icon: IconName; brand?: BrandLogo; perLabel: string; price: string };

/** Every service of a category as one grid, so the whole offer is visible without scrolling. */
export function ServiceGrid({ cards }: { cards: ServiceCard[] }) {
  return (
    // 9 or 6 services fill a 3-column desktop grid exactly; 4 columns would leave a lone card.
    <nav className={`zp-sgrid${cards.length > 9 ? ' compact' : ''}${cards.length % 3 === 0 && cards.length % 4 !== 0 ? ' thirds' : ''}`} aria-label="سرویس‌ها">
      {cards.map((c, i) => (
        <Link key={c.slug} href={`/orders/new?service=${c.slug}`} className="zp-scard zp-press" style={{ '--i': i } as React.CSSProperties}
          aria-label={`${c.name}، ${c.perLabel} ${c.price} تومان`}>
          {c.brand ? <BrandTile brand={c.brand} /> : <Tile icon={c.icon} />}
          <b>{c.name}</b>
          <small>{c.perLabel}</small>
          <span className="p">{c.price}<i>تومان</i></span>
        </Link>
      ))}
    </nav>
  );
}
