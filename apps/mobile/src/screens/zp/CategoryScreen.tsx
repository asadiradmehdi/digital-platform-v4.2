import { View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { appApi, type AppService } from '../../api/app';
import { formatTomanNumber } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { C, card, faNum, right, row } from '../../zp/base';
import { BrandTile, Tile } from '../../zp/brand';
import { SubScreen } from '../../zp/Shell';
import { Async, EmptyState, Press, T } from '../../zp/ui';

export type ServiceGroup = { base: string; name: string; members: AppService[]; first: AppService; fromPrice: number };

/** Variants of one offer (same `base`) collapse into one tile; the variant step comes after it. */
export function groupServices(services: AppService[]): ServiceGroup[] {
  const map = new Map<string, AppService[]>();
  for (const s of services) map.set(s.base, [...(map.get(s.base) ?? []), s]);
  return [...map.entries()].map(([base, members]) => {
    const sorted = [...members].sort((a, b) => a.variant.order - b.variant.order);
    const first = sorted[0];
    const name = members.length > 1 ? first.short.replace(` ${first.variant.label}`, '').trim() || first.short : first.short;
    return { base, name, members: sorted, first, fromPrice: Math.min(...members.map(m => m.unitPriceToman * m.per)) };
  });
}

/** Every offer of the category as a three-column grid, so the whole offer fits on one screen. */
function ServiceGrid({ services }: { services: AppService[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const groups = groupServices(services);
  const compact = groups.length > 9;
  const gap = 10;
  const w = Math.floor((Math.min(width, 560) - 36 - gap * 2) / 3);
  const tile = Math.round(Math.min(compact ? 42 : 48, w * 0.4));
  return (
    <View style={{ flexDirection: row, flexWrap: 'wrap', gap }}>
      {groups.map(g => {
        const s = g.first;
        const multi = g.members.length > 1;
        return (
        <Press key={g.base} accessibilityRole="link" accessibilityLabel={`${g.name}، ${multi ? `${g.members.length} نوع، از ` : ''}${s.perLabel} ${formatTomanNumber(g.fromPrice)} تومان`}
          onPress={() => (multi ? router.navigate({ pathname: '/variants/[base]', params: { base: g.base } }) : router.navigate({ pathname: '/order/[service]', params: { service: s.slug } }))}
          style={[{ width: w, alignItems: 'center', gap: 2, borderRadius: 20, paddingTop: compact ? 9 : 12, paddingBottom: compact ? 8 : 10, paddingHorizontal: 6 }, card]}>
          <View style={{ marginBottom: compact ? 3 : 5 }}>{s.brand ? <BrandTile brand={s.brand} size={tile} /> : <Tile icon={s.icon} size={tile} />}</View>
          <T w="b" size={compact ? 12 : 12.8} numberOfLines={compact ? 1 : 2} style={{ textAlign: 'center', lineHeight: 19, minHeight: compact ? undefined : 38 }}>{g.name}</T>
          <T size={10} color={multi ? C.goldText : C.muted} numberOfLines={1} style={{ textAlign: 'center' }}>{multi ? `${faNum(g.members.length)} نوع` : s.perLabel}</T>
          <View style={{ flexDirection: row, alignItems: 'baseline', gap: 3 }}>
            {multi ? <T size={9.5} color={C.muted}>از</T> : null}
            <T w="b" size={13.5}>{formatTomanNumber(g.fromPrice)}</T>
            <T w="sb" size={9.5} color={C.goldText}>تومان</T>
          </View>
        </Press>
        );
      })}
    </View>
  );
}

export function CategoryScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category: string }>();
  const catalog = useRemote(appApi.catalog);
  const cat = catalog.data?.categories.find(c => c.key === category);
  return (
    <SubScreen title={cat?.name ?? 'خدمات'}>
      <Async state={catalog} retry={catalog.retry}>
        {c => {
          if (!cat) return <EmptyState icon="box" title="دسته پیدا نشد" text="این دسته وجود ندارد. از فهرست خدمات یک دسته‌ی دیگر انتخاب کنید." action={{ label: 'بازگشت به خدمات', onPress: () => router.navigate('/services') }} />;
          const items = c.services.filter(s => s.category === cat.key);
          return (
            <>
              <View style={{ flexDirection: row, alignItems: 'center', gap: 14 }}>
                <Tile icon={cat.icon} size={64} />
                <View style={{ flex: 1, alignItems: right }}>
                  <T w="dx" size={20.5} numberOfLines={1} adjustsFontSizeToFit style={{ lineHeight: 30 }}>{cat.title ?? `خدمات ${cat.name}`}</T>
                  {items.length
                    ? <T size={12} color={C.muted} numberOfLines={2}><T w="b" size={12} color={C.goldText}>{faNum(items.length)} سرویس فعال</T> · {cat.note ?? 'قیمت شفاف، پرداخت از کیف پول'}</T>
                    : <T size={12} color={C.muted}>به‌زودی در زُحل پی</T>}
                </View>
              </View>
              {items.length ? <ServiceGrid services={items} /> : (
                <EmptyState icon={cat.icon} title="به‌زودی" text={`خدمات ${cat.name} در حال آماده‌سازی است. تا آن موقع از دسته‌های فعال استفاده کنید.`} action={{ label: 'بازگشت به خدمات', onPress: () => router.navigate('/') }} />
              )}
            </>
          );
        }}
      </Async>
    </SubScreen>
  );
}

