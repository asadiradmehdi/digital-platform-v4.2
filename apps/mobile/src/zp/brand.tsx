// Lapis enamel + illumination gold surfaces, drawn once with react-native-svg (no animation, no filters).
import { useId, type PropsWithChildren } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, G as SvgG, LinearGradient, Path, Pattern, Rect, Stop, Circle, SvgXml } from 'react-native-svg';
import { BRAND_LOGOS, type BrandLogo } from '@digital-platform/design-tokens';
import { atLeft, C, F, G, row, shadow, tRight } from './base';
import { Icon, type IconName } from './Icon';

export type FillKind = 'enamel' | 'metal' | 'goldLight' | 'turquoiseLapis' | 'danger';
const FILLS: Record<FillKind, readonly string[]> = { ...G, danger: ['#D65445', '#9E2A1F'] };

const useSvgId = (p: string) => p + useId().replace(/[^a-zA-Z0-9]/g, '');

/** Absolute gradient layer; `angle` 155° matches the web enamel. */
export function Fill({ kind = 'enamel', vertical }: { kind?: FillKind; vertical?: boolean }) {
  const id = useSvgId('f');
  const stops = FILLS[kind];
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id} x1={vertical ? '0' : '0.25'} y1="0" x2={vertical ? '0' : '0.75'} y2="1">
          {stops.map((c, i) => <Stop key={c + i} offset={stops.length === 1 ? 0 : i / (stops.length - 1)} stopColor={c} />)}
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Saturn ring hairlines plus an optional faint girih (8-point star) lattice. */
export function Ornament({ w = 400, h = 160, cx = 300, cy = 150, rot = -12, color = C.gold1, alpha = 1, girih = true }: {
  w?: number; h?: number; cx?: number; cy?: number; rot?: number; color?: string; alpha?: number; girih?: boolean;
}) {
  const id = useSvgId('o');
  const rings: Array<[number, number, number]> = [[1, 0.5, 1.2], [0.86, 0.3, 1], [0.74, 0.12, 7], [0.6, 0.18, 1]];
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" pointerEvents="none">
      {girih && (
        <>
          <Defs>
            <Pattern id={id} width="36" height="36" patternUnits="userSpaceOnUse">
              <Path d="M18 6l3.5 8.5L30 18l-8.5 3.5L18 30l-3.5-8.5L6 18l8.5-3.5z M18 9.5l7.5 3v11l-7.5 3-7.5-3v-11z" fill="none" stroke={color} strokeWidth={0.7} />
            </Pattern>
          </Defs>
          <Rect width={w * 0.5} height={h} fill={`url(#${id})`} opacity={0.14 * alpha} />
        </>
      )}
      <SvgG rotation={rot} origin={`${cx}, ${cy}`}>
        {rings.map(([k, o, sw]) => (
          <Ellipse key={k} cx={cx} cy={cy} rx={w * 0.62 * k} ry={h * 0.42 * k} fill="none" stroke={color} strokeOpacity={o * alpha} strokeWidth={sw} />
        ))}
      </SvgG>
    </Svg>
  );
}

/** Enamel (or gold-metal) panel with rim, ornament and children on top. */
export function Enamel({ kind = 'enamel', radius = 22, style, children }: PropsWithChildren<{ kind?: FillKind; radius?: number; style?: StyleProp<ViewStyle> }>) {
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: kind === 'goldLight' ? 'rgba(255,255,255,0.5)' : C.rim }, shadow(12, 26, 0.3, '#0b1b52'), style]}>
      <Fill kind={kind} />
      {children}
    </View>
  );
}

export type TileVariant = 'enamel' | 'gold' | 'ghost' | 'danger';

/** App-icon tile: lapis enamel with a solid gilded glyph; `gold` inverts it. */
export function Tile({ icon, size = 56, variant = 'enamel', badge }: { icon: IconName; size?: number; variant?: TileVariant; badge?: string }) {
  const r = size * 0.3;
  const glyph = variant === 'gold' ? C.accentStrong : variant === 'danger' ? '#fff' : C.gold1;
  const cut = variant === 'gold' ? '#e9c579' : variant === 'danger' ? '#a82d22' : '#13307f';
  return (
    <View style={{ width: size, height: size }}>
      <View style={[
        { width: size, height: size, borderRadius: r, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
        variant === 'ghost' ? { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: C.rim } : { borderWidth: 1, borderColor: variant === 'gold' ? 'rgba(255,255,255,0.55)' : C.rim },
      ]}>
        {variant !== 'ghost' && <Fill kind={variant === 'gold' ? 'metal' : variant === 'danger' ? 'danger' : 'enamel'} />}
        {variant !== 'ghost' && (
          <View style={{ position: 'absolute', top: 2, left: 2, right: 2, height: '48%', borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomLeftRadius: size, borderBottomRightRadius: size, backgroundColor: 'rgba(255,255,255,0.13)' }} />
        )}
        {/* Own layer so the glyph always paints above the absolutely positioned enamel. */}
        <View style={{ position: 'relative', zIndex: 1 }}><Icon name={icon} size={size * 0.5} color={glyph} cut={cut} /></View>
      </View>
      {badge ? (
        <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
      ) : null}
    </View>
  );
}

/** Porcelain tile carrying a product's own mark in its own colours (AI subscriptions). */
export function BrandTile({ brand, size = 56 }: { brand: BrandLogo; size?: number }) {
  const logo = BRAND_LOGOS[brand];
  return (
    <View accessibilityRole="image" accessibilityLabel={logo.label}
      style={[{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line }, shadow(6, 14, 0.12, '#3c2d0f')]}>
      <SvgXml xml={`<svg viewBox="0 0 24 24">${logo.svg}</svg>`} width={size * 0.54} height={size * 0.54} />
    </View>
  );
}

/** Ring-only Saturn mark: lapis outer ring, gold inner ring, gold moon. */
export function BrandMark({ size = 38 }: { size?: number }) {
  const a = useSvgId('a'); const b = useSvgId('b');
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id={a} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FBE8B4" /><Stop offset=".5" stopColor="#DCAA52" /><Stop offset="1" stopColor="#A8762A" /></LinearGradient>
        <LinearGradient id={b} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#2148A6" /><Stop offset="1" stopColor="#0B1B52" /></LinearGradient>
      </Defs>
      <SvgG rotation={-26} origin="20, 20">
        <Ellipse cx="20" cy="20" rx="17.5" ry="7.4" fill="none" stroke={`url(#${b})`} strokeWidth={3.2} strokeDasharray="60 5 200" />
        <Ellipse cx="20" cy="20" rx="10.6" ry="4.4" fill="none" stroke={`url(#${a})`} strokeWidth={3.2} />
      </SvgG>
      <Circle cx="33.6" cy="9.4" r="2.1" fill={`url(#${a})`} />
    </Svg>
  );
}

/** «زُحل پی» wordmark: two words, zamme on ز, «پی» in gold. */
export function Wordmark({ size = 24, latin = true, light }: { size?: number; latin?: boolean; light?: boolean }) {
  return (
    <View style={{ flexDirection: row, alignItems: 'center', gap: 10 }}>
      <BrandMark size={size * 1.55} />
      <View>
        <Text style={{ fontFamily: F.dx, fontSize: size, color: light ? '#fff' : C.ink, lineHeight: size * 1.5 }}>
          زُحل <Text style={{ color: light ? C.gold1 : C.gold3 }}>پی</Text>
        </Text>
        {latin && <Text style={{ fontFamily: F.b, fontSize: 9, letterSpacing: 3, color: C.muted, marginTop: -4, textAlign: tRight }}>ZOHALPAY</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -6, ...atLeft(-8), backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 2, borderColor: C.bg },
  badgeText: { fontFamily: F.b, fontSize: 8.5, color: C.muted },
});
