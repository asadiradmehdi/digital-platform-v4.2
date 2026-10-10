// Composite cards shared by the screens: category grid, order card, wallet strip and wallet card.
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { AppCategory, AppOrderCard } from '../api/app';
import { formatTomanNumber } from '../format';
import { C, G, card, right, row } from './base';
import { Enamel, Fill, Ornament, Tile } from './brand';
import { Cta, CountUp, Press, Progress, Rise, Star, StatusPill, T } from './ui';

/** Long category names get a short card label so every card shows the same type size. */
const shortName = (n: string) => (n.includes('هوش مصنوعی') ? 'هوش مصنوعی' : n);
/** Hints end in «و…» on the server; the card shows only the first two examples so nothing is cut mid-word. */
const shortHint = (h: string) => h.replace(/\s*و\s*(…|\.\.\.)\s*$/, '').split(/[،,]|\s+و\s+/).slice(0, 2).map(x => x.trim()).filter(Boolean).join('، ');

/** Service grid, three per row in priority order. Cards keep the web's compact size and type; the rows spread evenly over the height the screen leaves, so the page never scrolls. */
export function CategoryGrid({ categories }: { categories: AppCategory[] }) {
  const router = useRouter();
  const { width, height: winH } = useWindowDimensions();
  const [h, setH] = useState(0);
  const rows = Math.max(1, Math.ceil(categories.length / 3));
  const gap = 12;
  const rowGap = 14; // breathing room between card rows: the icon shrinks before the rows are allowed to touch
  // Same rule as the web: clamp(44px, min(13vw, 6.4vh), 56px); shrinks only when the space left is really short.
  let tile = Math.round(Math.max(44, Math.min(width * 0.13, winH * 0.064, 56)));
  const chrome = 12 * 2 + 8 + 17 + 13; // padding, gap, label line, hint line (hint sits 3px closer)
  if (h > 0 && rows * (tile + chrome) + (rows - 1) * rowGap > h) tile = Math.max(30, Math.floor((h - (rows - 1) * rowGap) / rows - chrome));
  const lines = Array.from({ length: rows }, (_, r) => categories.slice(r * 3, r * 3 + 3));
  return (
    <View accessibilityRole="menu" accessibilityLabel="دسته‌های خدمات" onLayout={e => setH(Math.floor(e.nativeEvent.layout.height))} style={{ flex: 1, justifyContent: 'flex-start', gap: rowGap, paddingVertical: 4 }}>
      {lines.map((line, r) => (
        <View key={r} style={{ flexDirection: row, gap }}>
          {line.map((c, i) => (
            <Rise key={c.key} delay={80 + (r * 3 + i) * 45} style={{ flex: 1 }}>
              <Press accessibilityRole="menuitem" accessibilityLabel={c.live ? `${c.name}، ${c.hint ?? ''}` : `${c.name}، به‌زودی`}
                onPress={() => router.navigate({ pathname: '/services/[category]', params: { category: c.key } })}
                style={[{ alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 18, opacity: c.live ? 1 : 0.82 }, card, { shadowOpacity: 0.13, borderColor: '#D9CCB2' }]}>
                <Tile icon={c.icon} size={tile} badge={c.live ? undefined : 'به‌زودی'} />
                <T w="b" size={12.5} color={C.ink} numberOfLines={1} style={{ textAlign: 'center', alignSelf: 'stretch', lineHeight: 17 }}>{shortName(c.name)}</T>
                {c.hint ? <T size={11} color={C.muted} numberOfLines={1} style={{ textAlign: 'center', alignSelf: 'stretch', marginTop: -3, lineHeight: 16 }}>{shortHint(c.hint)}</T> : null}
              </Press>
            </Rise>
          ))}
          {line.length < 3 ? Array.from({ length: 3 - line.length }, (_, k) => <View key={`pad${k}`} style={{ flex: 1 }} />) : null}
        </View>
      ))}
    </View>
  );
}

export function OrderCard({ order }: { order: AppOrderCard }) {
  const router = useRouter();
  const s = order.stage;
  return (
    <View accessible accessibilityLabel={`${order.title}، ${s.label}، ${formatTomanNumber(order.amountToman)} تومان`}
      style={[{ borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, gap: 10 }, card]}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 10 }}>
        <Tile icon={order.icon} size={38} />
        <View style={{ flex: 1, alignItems: right }}>
          <T w="b" size={14} numberOfLines={1}>{order.title}</T>
          <T size={11} color={C.muted}>{order.subtitle}</T>
        </View>
        <StatusPill label={s.label} tone={s.tone} />
      </View>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 10 }}>
        <Progress steps={s.steps} tone={s.tone} />
        <T w="sb" size={10.5} color={C.muted}>{formatTomanNumber(order.amountToman)} تومان</T>
        {order.reorder ? (
          <Press accessibilityRole="button" accessibilityLabel={`سفارش دوباره‌ی ${order.title}`}
            onPress={() => router.navigate({ pathname: '/order/[service]', params: { service: order.reorder!.service, ...(order.reorder!.qty ? { qty: String(order.reorder!.qty) } : {}) } })}
            style={{ paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', backgroundColor: G.metal[G.metal.length - 1] }}>
            <Fill kind="metal" vertical />
            <T w="b" size={11.5} color={C.onGold} numberOfLines={1}>سفارش دوباره</T>
          </Press>
        ) : null}
      </View>
    </View>
  );
}

/** Home strip: balance, loyalty level and the top-up shortcut. */
export function WalletStrip({ balanceToman, tierName }: { balanceToman: number | null; tierName: string | null }) {
  const router = useRouter();
  // Narrow phones drop the level badge (as the web does under 380px) so the label never wraps.
  const narrow = useWindowDimensions().width < 380;
  return (
    <Enamel radius={22} style={{ flexDirection: row, alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
      <Ornament w={400} h={70} cx={60} cy={70} rot={10} alpha={0.5} girih={false} />
      <Tile icon="wallet" size={40} variant="ghost" />
      <View style={{ flex: 1, alignItems: right }}>
        <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
          <T size={11.5} color="rgba(255,255,255,0.72)" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1 }}>موجودی شما</T>
          {tierName && !narrow ? <View style={{ backgroundColor: C.gold1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}><T w="dx" size={9.5} color={C.accentStrong} style={{ lineHeight: 15 }}>سطح {tierName}</T></View> : null}
        </View>
        <View style={{ flexDirection: row, alignItems: 'baseline', gap: 4 }}>
          {balanceToman == null ? <T w="b" size={17.5} color="#fff">—</T> : <CountUp w={balanceToman === 0 ? 'brand' : 'b'} size={balanceToman === 0 ? 19 : 17.5} color="#fff" value={balanceToman} format={formatTomanNumber} />}
          <T size={10.5} color="rgba(255,255,255,0.65)">تومان</T>
        </View>
      </View>
      <Cta label="افزایش موجودی" small={narrow} onPress={() => router.navigate('/wallet')} />
    </Enamel>
  );
}

/** Wallet tab hero: enamel card with the gold wordmark, balance and level. */
export function WalletCard({ balanceToman, tierName, tail }: { balanceToman: number | null; tierName: string; tail?: string }) {
  return (
    <Enamel radius={26} style={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: 16, gap: 12 }}>
      <Ornament w={400} h={240} cx={40} cy={250} rot={14} alpha={0.55} />
      <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center' }}>
        <T w="dx" size={15} color={C.gold1}>زُحل پی</T>
        <View style={{ width: 38, height: 28, borderRadius: 7, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#E9C579' }} />
          <View style={{ height: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(90,60,10,0.35)' }} />
        </View>
      </View>
      <View style={{ alignItems: right, gap: 4 }}>
        <T size={11} color="rgba(255,255,255,0.7)">موجودی کیف پول</T>
        <View style={{ flexDirection: row, alignItems: 'baseline', gap: 6 }}>
          {balanceToman == null ? <T w="b" size={32} color="#fff" style={{ lineHeight: 42 }}>—</T> : <CountUp w={balanceToman === 0 ? 'brand' : 'b'} size={32} color="#fff" style={{ lineHeight: 42 }} value={balanceToman} format={formatTomanNumber} />}
          <T size={12.5} color="rgba(255,255,255,0.7)">تومان</T>
        </View>
      </View>
      <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}><Star size={12} color={C.gold1} /><T w="sb" size={11.5} color={C.gold1}>سطح {tierName}</T></View>
        {tail ? <T size={11.5} color="rgba(255,255,255,0.75)" style={{ letterSpacing: 3 }}>{`•••• ${tail}`}</T> : null}
      </View>
    </Enamel>
  );
}
