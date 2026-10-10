// Second step of the order path: the variants of one offer (e.g. Instagram followers → ایرانی / خارجی / اقتصادی).
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { appApi } from '../../api/app';
import { formatTomanNumber } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { C, card, fwd, right, row } from '../../zp/base';
import { BrandTile, Tile } from '../../zp/brand';
import { Icon } from '../../zp/Icon';
import { SubScreen } from '../../zp/Shell';
import { Async, EmptyState, Press, Rise, Star, T } from '../../zp/ui';
import { groupServices } from './CategoryScreen';

export function VariantScreen() {
  const router = useRouter();
  const { base } = useLocalSearchParams<{ base: string }>();
  const catalog = useRemote(appApi.catalog);
  const group = catalog.data ? groupServices(catalog.data.services.filter(s => s.base === base))[0] : undefined;
  return (
    <SubScreen title={group?.name ?? 'انتخاب نوع'}>
      <Async state={catalog} retry={catalog.retry}>
        {() => {
          if (!group) return <EmptyState icon="box" title="خدمت پیدا نشد" text="این خدمت در حال حاضر در دسترس نیست." action={{ label: 'بازگشت به خدمات', onPress: () => router.navigate('/services') }} />;
          const s = group.first;
          return (
            <>
              <View style={{ flexDirection: row, alignItems: 'center', gap: 14 }}>
                {s.brand ? <BrandTile brand={s.brand} size={60} /> : <Tile icon={s.icon} size={60} />}
                <View style={{ flex: 1, alignItems: right }}>
                  <T w="dx" size={19.5} style={{ lineHeight: 30 }} accessibilityRole="header">{group.name}</T>
                  <T size={12} color={C.muted}>کدام نوع را می‌خواهید؟</T>
                </View>
              </View>
              <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}><Star size={11} /><T w="b" size={12} color={C.goldText}>نوع خدمت</T></View>
              <View style={{ gap: 8 }}>
                {group.members.map((m, i) => (
                  <Rise key={m.slug} delay={i * 80}>
                  <Press accessibilityRole="link" accessibilityLabel={`${m.variant.label}، ${m.perLabel} ${formatTomanNumber(m.unitPriceToman * m.per)} تومان`}
                    onPress={() => router.navigate({ pathname: '/order/[service]', params: { service: m.slug } })}
                    style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 }, card]}>
                    <View style={{ flex: 1, alignItems: right, gap: 2 }}>
                      <T w="b" size={15}>{m.variant.label}</T>
                      <T size={11.5} color={C.muted} numberOfLines={2}>{m.variant.hint}</T>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T w="b" size={14}>{formatTomanNumber(m.unitPriceToman * m.per)}</T>
                      <T size={10} color={C.muted}>تومان · {m.perLabel}</T>
                    </View>
                    <Icon name={fwd} size={16} color={C.muted} stroke={2.4} />
                  </Press>
                  </Rise>
                ))}
              </View>
            </>
          );
        }}
      </Async>
    </SubScreen>
  );
}
