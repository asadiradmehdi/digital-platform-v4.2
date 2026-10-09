// Composite cards shared by the screens: category grid, order card, wallet strip and wallet card.
import { useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { AppCategory, AppOrderCard } from '../api/app';
import { formatTomanNumber } from '../format';
import { C, card, right, row } from './base';
import { Enamel, Ornament, Tile } from './brand';
import { Cta, Press, Progress, Star, StatusPill, T } from './ui';

/** 12-category grid; categories without priced services show «به‌زودی». */
/** Service grid, three per row in priority order; every card names what the category sells in one line. */
export function CategoryGrid({ categories }: { categories: AppCategory[] }) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const tile = Math.round(Math.max(44, Math.min(56, width * 0.13, height * 0.064)));
  return (
    <View accessibilityRole="menu" accessibilityLabel="دسته‌های خدمات" style={{ flex: 1, flexDirection: row, flexWrap: 'wrap', alignContent: 'space-evenly', justifyContent: 'space-between', rowGap: Math.max(8, Math.min(14, height * 0.016)) }}>
      {categories.map(c => (
        <Press key={c.key} accessibilityRole="menuitem" accessibilityLabel={c.live ? `${c.name}، ${c.hint ?? ''}` : `${c.name}، به‌زودی`}
          onPress={() => router.navigate({ pathname: '/services/[category]', params: { category: c.key } })}
          style={[{ width: '31.8%', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 18, opacity: c.live ? 1 : 0.82 }, card]}>
          <Tile icon={c.icon} size={tile} badge={c.live ? undefined : 'به‌زودی'} />
          <T w="b" size={12.5} color={C.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ textAlign: 'center', alignSelf: 'stretch' }}>{c.name}</T>
          {c.hint ? <T size={10} color={C.muted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ textAlign: 'center', alignSelf: 'stretch', marginTop: -3 }}>{c.hint}</T> : null}
        </Press>
      ))}
    </View>
  );
}

export function OrderCard({ order }: { order: AppOrderCard }) {
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
          <T size={11} color="rgba(255,255,255,0.72)" numberOfLines={1}>موجودی شما</T>
          {tierName && !narrow ? <View style={{ backgroundColor: C.gold1, borderRadius: 999, paddingHorizontal: 8 }}><T w="b" size={9.5} color={C.accentStrong}>سطح {tierName}</T></View> : null}
        </View>
        <View style={{ flexDirection: row, alignItems: 'baseline', gap: 4 }}>
          <T w="b" size={17.5} color="#fff">{balanceToman == null ? '—' : formatTomanNumber(balanceToman)}</T>
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
          <T w="b" size={32} color="#fff" style={{ lineHeight: 42 }}>{balanceToman == null ? '—' : formatTomanNumber(balanceToman)}</T>
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
