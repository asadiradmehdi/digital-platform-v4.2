import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { appApi, type AppService } from '../../api/app';
import { formatTomanNumber } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { C, F, card, row, tRight } from '../../zp/base';
import { BrandTile, Tile } from '../../zp/brand';
import { Icon } from '../../zp/Icon';
import { bestSellers, searchServices } from '../../zp/search';
import { SubScreen } from '../../zp/Shell';
import { Async, EmptyState, Press, Star, T } from '../../zp/ui';

function ServiceRow({ s, catalogName, hot }: { s: AppService; catalogName: string; hot?: boolean }) {
  const router = useRouter();
  return (
    <Press accessibilityRole="link" accessibilityLabel={`${s.name}، ${catalogName}، ${s.perLabel} ${formatTomanNumber(s.unitPriceToman * s.per)} تومان`}
      onPress={() => router.navigate({ pathname: '/order/[service]', params: { service: s.slug } })}
      style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10 }, card, { shadowOpacity: 0.06 }]}>
      {s.brand ? <BrandTile brand={s.brand} size={38} /> : <Tile icon={s.icon} size={38} />}
      <View style={{ flex: 1, gap: 1 }}>
        <T w="b" size={13.5} numberOfLines={1}>{s.name}</T>
        <T size={11} color={C.muted} numberOfLines={1}>{catalogName} · {s.perLabel}</T>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T w="b" size={13}>{formatTomanNumber(s.unitPriceToman * s.per)}</T>
        <T w="sb" size={9.5} color={C.goldText}>{hot ? 'پرفروش' : 'تومان'}</T>
      </View>
    </Press>
  );
}

/** Search across every service; with nothing typed it lists the best sellers first. */
export function SearchScreen() {
  const catalog = useRemote(appApi.catalog);
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  return (
    <SubScreen title="جستجو">
      <View style={[{ flexDirection: row, alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 14, borderWidth: 1.5, borderColor: focused ? C.gold2 : C.line, backgroundColor: C.surface2 }]}>
        <Icon name="search" size={20} color={C.muted} />
        <TextInput value={q} onChangeText={setQ} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoFocus returnKeyType="search"
          accessibilityLabel="جستجوی خدمات" placeholder="مثلاً فالوور اینستاگرام یا چت‌جی‌پی‌تی" placeholderTextColor={C.subtle}
          style={{ flex: 1, fontFamily: F.m, fontSize: 14.5, color: C.ink, paddingVertical: 13, textAlign: tRight }} />
      </View>
      <Async state={catalog} retry={catalog.retry}>
        {c => {
          const name = (key: string) => c.categories.find(x => x.key === key)?.name ?? '';
          const typed = q.trim().length > 0;
          const list = typed ? searchServices(c, q) : bestSellers(c, 8);
          if (typed && !list.length) {
            return <EmptyState icon="search" title="چیزی پیدا نشد" text="عبارت دیگری امتحان کنید، مثلاً نام شبکه یا نوع خدمت؛ یا از پشتیبانی بپرسید." />;
          }
          return (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
                <Star size={11} />
                <T w="b" size={12} color={C.goldText}>{typed ? 'نتیجه‌ها' : 'پرفروش‌ترین‌ها'}</T>
              </View>
              {list.map((s, i) => <ServiceRow key={s.slug} s={s} catalogName={name(s.category)} hot={!typed && i < 3} />)}
            </View>
          );
        }}
      </Async>
    </SubScreen>
  );
}
