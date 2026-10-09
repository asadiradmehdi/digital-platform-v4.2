import type { ReactNode } from 'react';
import { ZIcon, type IconName } from './ZIcon';
import { BRAND_LOGOS, type BrandLogo } from '../../packages/design-tokens/src/brand-logos';

/** Lapis-enamel app-icon tile with a solid gilded glyph. `gold` inverts it (gold tile, lapis glyph). */
export function Tile({ icon, size, gold, danger, soft, className, children }: {
  icon?: IconName; size?: number; gold?: boolean; danger?: boolean; soft?: boolean; className?: string; children?: ReactNode;
}) {
  const cls = ['zp-tile', gold && 'gold', danger && 'danger', soft && 'soft', className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={size ? ({ '--s': `${size}px` } as React.CSSProperties) : undefined}>
      {icon && <ZIcon name={icon} />}
      {children}
    </span>
  );
}

/** Porcelain tile carrying a product's own mark in its own colours (AI subscriptions). */
export function BrandTile({ brand, size }: { brand: BrandLogo; size?: number }) {
  return (
    <span className="zp-tile zp-btile" style={size ? ({ '--s': `${size}px` } as React.CSSProperties) : undefined} role="img" aria-label={BRAND_LOGOS[brand].label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: BRAND_LOGOS[brand].svg }} />
    </span>
  );
}

/** Ring-only Saturn mark (no planet): lapis outer ring, gold inner ring, gold moon. */
export function BrandMark({ size = 38, id = 'zpm' }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FBE8B4" /><stop offset=".5" stopColor="#DCAA52" /><stop offset="1" stopColor="#A8762A" /></linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22397F" /><stop offset="1" stopColor="#0A1238" /></linearGradient>
      </defs>
      <ellipse cx="20" cy="20" rx="17.5" ry="7.4" transform="rotate(-26 20 20)" fill="none" stroke={`url(#${id}-b)`} strokeWidth="3.2" strokeDasharray="60 5 200" />
      <ellipse cx="20" cy="20" rx="10.6" ry="4.4" transform="rotate(-26 20 20)" fill="none" stroke={`url(#${id}-a)`} strokeWidth="3.2" />
      <circle cx="33.6" cy="9.4" r="2.1" fill={`url(#${id}-a)`} />
    </svg>
  );
}

/** «زُحل پی» wordmark: two words, zamme on ز, «پی» in metallic gold. */
export function Wordmark({ latin = true, id }: { latin?: boolean; id?: string }) {
  return (
    <span className="zp-logo">
      <BrandMark id={id} />
      <span className="zp-wm">
        <b>زُحل <span className="zp-gtext">پی</span></b>
        {latin && <small>ZOHALPAY</small>}
      </span>
    </span>
  );
}

/**
 * Decorative ornament for enamel surfaces: Saturn ring hairlines plus a faint girih (8-point star) lattice.
 * Pure SVG, painted once — no animation, no filters.
 */
export function Ornament({ id, w = 400, h = 160, cx = 300, cy = 150, rot = -12, color = '#F2D390', alpha = 1, girih = true }: {
  id: string; w?: number; h?: number; cx?: number; cy?: number; rot?: number; color?: string; alpha?: number; girih?: boolean;
}) {
  const rings: Array<[number, number, number]> = [[1, .5, 1.2], [.86, .3, 1], [.74, .12, 7], [.6, .18, 1]];
  return (
    <svg className="zp-orn" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {girih && (
        <>
          <defs>
            <pattern id={`${id}-p`} width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M18 6l3.5 8.5L30 18l-8.5 3.5L18 30l-3.5-8.5L6 18l8.5-3.5z M18 9.5l7.5 3v11l-7.5 3-7.5-3v-11z" fill="none" stroke={color} strokeWidth=".7" />
            </pattern>
            <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset=".55" stopColor="#fff" stopOpacity="0" /></linearGradient>
            <mask id={`${id}-m`}><rect width={w} height={h} fill={`url(#${id}-g)`} /></mask>
          </defs>
          <rect width={w} height={h} fill={`url(#${id}-p)`} opacity={.22 * alpha} mask={`url(#${id}-m)`} />
        </>
      )}
      <g transform={`rotate(${rot} ${cx} ${cy})`} fill="none">
        {rings.map(([k, o, sw]) => (
          <ellipse key={k} cx={cx} cy={cy} rx={w * .62 * k} ry={h * .42 * k} stroke={color} strokeOpacity={o * alpha} strokeWidth={sw} />
        ))}
      </g>
    </svg>
  );
}
