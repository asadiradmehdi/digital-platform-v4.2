// Lapis enamel + illumination gold surfaces, drawn once with react-native-svg (no animation, no filters).
import { useId, useState, type PropsWithChildren } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, G as SvgG, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop, Circle, SvgXml } from 'react-native-svg';
import { BRAND_LOGOS, type BrandLogo } from '@digital-platform/design-tokens';
import { atLeft, C, F, G, row, shadow, tRight } from './base';
import { Icon, type IconName } from './Icon';

export type FillKind = 'enamel' | 'metal' | 'goldLight' | 'turquoiseLapis' | 'danger';
const FILLS: Record<FillKind, readonly string[]> = { ...G, danger: ['#D65445', '#9E2A1F'] };

const useSvgId = (p: string) => p + useId().replace(/[^a-zA-Z0-9]/g, '');

/**
 * Absolute gradient layer; `angle` 155° matches the web enamel.
 * Android release builds mis-scale percent-sized SVGs with a stretched viewBox (half the button stayed
 * unpainted), so the layer measures itself and draws in real pixels, over a solid fallback colour.
 */
/** Same geometry as CSS `linear-gradient(<deg>, …)`, so gold buttons match the web exactly (null = the older diagonal). */
function gradientLine(w: number, h: number, deg: number | null) {
  if (deg == null) return { x1: w * 0.25, y1: 0, x2: w * 0.75, y2: h };
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a); const dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  return { x1: w / 2 - dx * half, y1: h / 2 - dy * half, x2: w / 2 + dx * half, y2: h / 2 + dy * half };
}

/** Soft ambient light behind a screen: a warm gold glow from the top corner and a faint lapis haze from the bottom, so the ivory ground has depth. */
export function Ambient() {
  const id = useSvgId('a');
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box && box.w > 0 ? (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <RadialGradient id={`${id}g`} cx={box.w * 0.9} cy={0} r={box.w * 0.95} gradientUnits="userSpaceOnUse">
              <Stop offset={0} stopColor="#E9C46A" stopOpacity={0.3} />
              <Stop offset={1} stopColor="#E9C46A" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={`${id}l`} cx={0} cy={box.h} r={box.w * 0.9} gradientUnits="userSpaceOnUse">
              <Stop offset={0} stopColor="#2148a6" stopOpacity={0.05} />
              <Stop offset={1} stopColor="#2148a6" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={box.w} height={box.h} fill={`url(#${id}g)`} />
          <Rect x={0} y={0} width={box.w} height={box.h} fill={`url(#${id}l)`} />
        </Svg>
      ) : null}
    </View>
  );
}

export function Fill({ kind = 'enamel', vertical }: { kind?: FillKind; vertical?: boolean }) {
  const id = useSvgId('f');
  const stops = FILLS[kind];
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!box || box.w !== width || box.h !== height) setBox({ w: width, h: height });
  };
  const line = box ? gradientLine(box.w, box.h, kind === 'metal' || vertical ? 160 : null) : { x1: 0, y1: 0, x2: 0, y2: 0 };
  return (
    <View pointerEvents="none" onLayout={onLayout} style={[StyleSheet.absoluteFill, { backgroundColor: stops[stops.length - 1] }]}>
      {box && box.w > 0 && box.h > 0 ? (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <LinearGradient id={id} gradientUnits="userSpaceOnUse"
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}>
              {stops.map((c, i) => <Stop key={c + i} offset={stops.length === 1 ? 0 : i / (stops.length - 1)} stopColor={c} />)}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={box.w} height={box.h} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
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
    <View style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: FILLS[kind][FILLS[kind].length - 1], borderWidth: 1, borderColor: kind === 'goldLight' ? 'rgba(255,255,255,0.5)' : C.rim }, shadow(12, 26, 0.3, '#0A1238'), style]}>
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
  const cut = variant === 'gold' ? '#e9c579' : variant === 'danger' ? '#a82d22' : '#142257';
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
        <LinearGradient id={b} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#22397F" /><Stop offset="1" stopColor="#0A1238" /></LinearGradient>
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
        {/* Roomy line box + padding: Android clips the zamme above ز and the swash of «ی» when the box hugs the glyphs. */}
        <Text style={{ fontFamily: F.brand, fontSize: size, color: light ? '#fff' : C.ink, lineHeight: size * 2, paddingTop: size * 0.3, paddingHorizontal: 4, marginBottom: -size * 0.3, includeFontPadding: true, textAlignVertical: 'center' }}>
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
