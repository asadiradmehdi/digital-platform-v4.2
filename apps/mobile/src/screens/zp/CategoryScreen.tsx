import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { appApi, type AppService } from '../../api/app';
import { formatQuantityWords, formatTomanNumber } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { C, card, faNum, fwd, right, row, shadow } from '../../zp/base';
import { Tile } from '../../zp/brand';
import { Icon } from '../../zp/Icon';
import { SubScreen } from '../../zp/Shell';
import { Async, EmptyState, Press, T } from '../../zp/ui';

const ORDER = ['فالوور', 'ممبر', 'لایک', 'بازدید', 'کامنت'];
const rank = (l: string) => (ORDER.indexOf(l) + 1) || 99;

function Rows({ services }: { services: AppService[] }) {
  const router = useRouter();
  const groups = useMemo(() => {
    const out: Array<{ label: string; rows: AppService[] }> = [];
    for (const s of services) {
      let g = out.find(x => x.label === s.group);
      if (!g) out.push(g = { label: s.group, rows: [] });
      g.rows.push(s);
    }
    return out.sort((a, b) => rank(a.label) - rank(b.label));
  }, [services]);
  const [g, setG] = useState(0);
  const group = groups[g] ?? groups[0];

  return (
    <>
      {groups.length > 1 && (
        <View accessibilityRole="tablist" style={{ flexDirection: row, backgroundColor: C.surface2, borderRadius: 15, padding: 4, gap: 2, borderWidth: 1, borderColor: C.line }}>
          {groups.map((x, k) => {
            const on = k === g;
            return (
              <Pressable key={x.label} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setG(k)}
                style={[{ flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' }, on && [{ backgroundColor: C.surface }, shadow(2, 8, 0.15)]]}>
                <T w={on ? 'b' : 'sb'} size={13} color={on ? C.ink : C.muted} style={{ textAlign: 'center' }}>{x.label}</T>
                {on ? <View style={{ position: 'absolute', bottom: 3, width: 14, height: 2, borderRadius: 2, backgroundColor: C.gold2 }} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={{ gap: 10 }}>
        {group.rows.map(s => (
          <Press key={s.slug} accessibilityRole="link" onPress={() => router.navigate({ pathname: '/order/[service]', params: { service: s.slug } })}
            style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 12 }, card]}>
            <Tile icon={s.icon} size={46} />
            <View style={{ flex: 1, alignItems: right, gap: 2 }}>
              <T w="b" size={14.5}>{s.name}</T>
              <T size={11.5} color={C.muted} numberOfLines={1}>{s.description ?? 'ثبت آنی · پیگیری لحظه‌ای'}</T>
            </View>
            <View style={{ alignItems: 'center' }}>
              <T size={10} color={C.muted}>{s.per > 1 ? `هر ${formatQuantityWords(s.per)} ${s.unit}` : `هر ${s.unit}`}</T>
              <View style={{ flexDirection: row, alignItems: 'baseline', gap: 3 }}>
                <T w="b" size={14.5}>{formatTomanNumber(s.unitPriceToman * s.per)}</T>
                <T w="sb" size={10} color={C.goldText}>تومان</T>
              </View>
            </View>
            <Icon name={fwd} size={16} color={C.muted} stroke={2.4} />
          </Press>
        ))}
      </View>
    </>
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
                  <T w="dx" size={20.5} style={{ lineHeight: 30 }}>خدمات {cat.name}</T>
                  {items.length
                    ? <T size={12} color={C.muted} numberOfLines={2}><T w="b" size={12} color={C.goldText}>{faNum(items.length)} سرویس فعال</T> · قیمت شفاف، پرداخت از کیف پول</T>
                    : <T size={12} color={C.muted}>به‌زودی در زُحل پی</T>}
                </View>
              </View>
              {items.length ? <Rows services={items} /> : (
                <EmptyState icon={cat.icon} title="به‌زودی" text={`خدمات ${cat.name} در حال آماده‌سازی است. تا آن موقع از دسته‌های فعال استفاده کنید.`} action={{ label: 'بازگشت به خدمات', onPress: () => router.navigate('/') }} />
              )}
            </>
          );
        }}
      </Async>
    </SubScreen>
  );
}

