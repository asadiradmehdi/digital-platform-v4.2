import Link from 'next/link';
import { BrandTile, Tile } from '../../../components/zp/brand';
import type { IconName } from '../../../components/zp/ZIcon';
import type { BrandLogo } from '../../../packages/design-tokens/src/brand-logos';

export type ServiceCard = { slug: string; base: string; name: string; icon: IconName; brand?: BrandLogo; perLabel: string; price: string; priceValue: number; variant: string };

/** Variants of one offer (same `base`) collapse into one tile; the variant step comes after it. */
function group(cards: ServiceCard[]) {
  const map = new Map<string, ServiceCard[]>();
  for (const c of cards) map.set(c.base, [...(map.get(c.base) ?? []), c]);
  return [...map.values()].map(members => {
    const first = members[0];
    return { first, count: members.length, name: members.length > 1 ? first.name.replace(` ${first.variant}`, '').trim() || first.name : first.name, from: members.length > 1 ? Math.min(...members.map(m => m.priceValue)) : first.priceValue };
  });
}
const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

/** Every service of a category as one grid, so the whole offer is visible without scrolling. */
export function ServiceGrid({ cards }: { cards: ServiceCard[] }) {
  const groups = group(cards);
  return (
    // 9 or 6 services fill a 3-column desktop grid exactly; 4 columns would leave a lone card.
    <nav className={`zp-sgrid${groups.length > 9 ? ' compact' : ''}${groups.length % 3 === 0 && groups.length % 4 !== 0 ? ' thirds' : ''}`} aria-label="سرویس‌ها">
      {groups.map(({ first: c, count, name, from }, i) => (
        <Link key={c.base} href={count > 1 ? `/choose/${encodeURIComponent(c.base)}` : `/orders/new?service=${c.slug}`} className="zp-scard zp-press" style={{ '--i': i } as React.CSSProperties}
          aria-label={`${name}، ${count > 1 ? `${fa(count)} سرویس، از ` : ''}${c.perLabel} ${fa(from)} تومان`}>
          {c.brand ? <BrandTile brand={c.brand} /> : <Tile icon={c.icon} />}
          <b>{name}</b>
          <small>{count > 1 ? <span className="zp-live-s"><i className="zp-live" aria-hidden />{fa(count)} سرویس</span> : c.perLabel}</small>
          <span className="p">{count > 1 ? <em>از </em> : null}{fa(from)}<i>تومان</i></span>
        </Link>
      ))}
    </nav>
  );
}
