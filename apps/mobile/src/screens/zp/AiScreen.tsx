import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { appApi } from '../../api/app';
import { subscriptions } from '../../api/client';
import { useRemote } from '../../hooks/useRemote';
import { C, card, faNum, fwd, right, row, shadow } from '../../zp/base';
import { Enamel, Ornament, Tile } from '../../zp/brand';
import { Icon } from '../../zp/Icon';
import { SubScreen } from '../../zp/Shell';
import { Async, Cta, EmptyState, Press, SecHead, StatusPill, T } from '../../zp/ui';

const AI_CATEGORIES = ['ai', 'ai-subscriptions'];

/** «ابزارهای هوش مصنوعی»: AI services from the catalogue and whether the member's plan includes AI. */
export function AiScreen() {
  const router = useRouter();
  const catalog = useRemote(appApi.catalog);
  const subs = useRemote(subscriptions.list);
  const hasAi = subs.data?.items.some(s => ['ACTIVE', 'TRIALING'].includes(s.status) && s.entitlements.includes('ai_usage')) ?? false;

  return (
    <SubScreen title="ابزارهای هوش مصنوعی">
      <Enamel radius={22} style={[{ padding: 16, gap: 12 }, shadow(12, 26, 0.3, '#0A1238')]}>
        <Ornament w={400} h={150} cx={70} cy={150} rot={10} color={C.gold1} alpha={0.55} />
        <View style={{ flexDirection: row, alignItems: 'center', gap: 12 }}>
          <Tile icon="ai" variant="gold" size={46} />
          <View style={{ flex: 1, alignItems: right }}>
            <T w="b" size={17} color="#fff">هوش مصنوعی برای کسب‌وکار شما</T>
            <T size={11.5} color="rgba(255,255,255,0.74)" style={{ lineHeight: 20 }}>تولید محتوا و اشتراک ابزارهای هوشمند، با بازبینی تیم زُحل پی.</T>
          </View>
        </View>
        {subs.status === 'success' ? (
          <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
            <StatusPill label={hasAi ? 'هوش مصنوعی در پلن شما فعال است' : 'پلن شما شامل هوش مصنوعی نیست'} tone={hasAi ? 'ok' : 'idle'} />
          </View>
        ) : null}
      </Enamel>

      <SecHead title="خدمات هوش مصنوعی" />
      <Async state={catalog} retry={catalog.retry}>
        {c => {
          const cats = c.categories.filter(x => AI_CATEGORIES.includes(x.key));
          if (cats.length === 0) return <EmptyState icon="ai" title="خدمتی در دسترس نیست" text="در حال حاضر خدمت هوش مصنوعی فعالی برای نمایش وجود ندارد." />;
          return (
            <View style={{ gap: 8 }}>
              {cats.map(cat => (
                <Press key={cat.key} accessibilityRole="button" accessibilityLabel={cat.name}
                  onPress={() => router.navigate({ pathname: '/services/[category]', params: { category: cat.key } })}
                  style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 16, padding: 10 }, card, { shadowOpacity: 0.06 }]}>
                  <Tile icon={cat.icon} size={44} />
                  <View style={{ flex: 1, alignItems: right }}>
                    <T w="sb" size={14.5}>{cat.title ?? cat.name}</T>
                    <T size={11} color={C.muted}>{cat.note ?? `${faNum(cat.count)} سرویس`}</T>
                  </View>
                  <Icon name={fwd} size={16} color={C.muted} stroke={2.4} />
                </Press>
              ))}
            </View>
          );
        }}
      </Async>
      {!hasAi && subs.status === 'success' ? <Cta label="مشاهده‌ی پلن‌ها" full onPress={() => router.navigate('/subscriptions')} /> : null}
    </SubScreen>
  );
}
