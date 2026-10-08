import Link from 'next/link';
import { Tile } from './brand';
import { CATEGORIES } from '../../lib/catalog-ui';

/** 12-category service grid; categories without priced services show «به‌زودی». */
export function CategoryGrid({ live }: { live: Set<string> }) {
  return (
    <nav className="zp-grid" aria-label="دسته‌های خدمات">
      {CATEGORIES.map((c, i) => {
        const soon = !live.has(c.key);
        return (
          <Link key={c.key} href={`/services/${c.key}`} className={`zp-svc zp-press${soon ? ' is-soon' : ''}`} style={{ '--i': i } as React.CSSProperties}>
            <Tile icon={c.icon}>{soon && <span className="soon">به‌زودی</span>}</Tile>
            {c.name}
          </Link>
        );
      })}
    </nav>
  );
}
