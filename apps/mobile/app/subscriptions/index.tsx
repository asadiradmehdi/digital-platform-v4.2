import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Metric, Section, State, Status, Title, UsageBar } from '../../src/components/Ui';
import { theme } from '../../src/theme';
import { useQuery } from '../../src/hooks/useQuery';
import { subscriptions } from '../../src/api/client';
import type { SubscriptionSummary } from '../../src/api/client';
import { formatToman } from '../../src/format';

const statusLabel: Record<string, string> = {
  ACTIVE: 'فعال', TRIALING: 'آزمایشی', PAUSED: 'متوقف',
  CANCELLED: 'لغو شده', EXPIRED: 'منقضی',
};
type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';
function statusTone(s: string): Tone {
  if (s === 'ACTIVE') return 'success';
  if (s === 'TRIALING') return 'info';
  if (s === 'PAUSED') return 'warning';
  return 'danger';
}

const planLabel: Record<string, string> = { free: 'رایگان', basic: 'پایه', pro: 'Pro', enterprise: 'سازمانی' };

function SubscriptionCard({ sub }: { sub: SubscriptionSummary }) {
  return (
    <Card emphasis>
      <View style={styles.planRow}>
        <View>
          <Text style={styles.planName}>{planLabel[sub.plan] ?? sub.plan}</Text>
          <Text style={styles.planPrice}>{formatToman(sub.priceMinor)} / ماه</Text>
        </View>
        <Status tone={statusTone(sub.status)}>{statusLabel[sub.status] ?? sub.status}</Status>
      </View>
      <Text style={styles.renew}>
        تمدید: {new Date(sub.renewalDate).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })}
      </Text>
      <Divider />
      <Action tone="secondary">تغییر پلن</Action>
    </Card>
  );
}

export default function Subscriptions() {
  const subsQ = useQuery(() => subscriptions.list(), []);
  const items = subsQ.data?.items ?? [];
  const activeSub = items[0];

  return (
    <Screen>
      <Title eyebrow="BILLING / SUBSCRIPTIONS" description="Entitlementها و قیمت از سرور enforce می‌شوند">
        اشتراک‌ها
      </Title>

      {subsQ.status === 'loading' && <State loading />}
      {subsQ.status === 'error' && <State error={subsQ.error} />}
      {subsQ.status === 'success' && items.length === 0 && (
        <>
          <State empty="اشتراکی فعال نیست." />
          <Action>انتخاب پلن</Action>
        </>
      )}

      {activeSub && <SubscriptionCard sub={activeSub} />}

      {activeSub && activeSub.entitlements.length > 0 && (
        <Card>
          <Section title="امکانات فعال" />
          {activeSub.entitlements.map((e, i) => (
            <View key={e}>
              {i > 0 && <Divider />}
              <View style={styles.featureRow}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.featureText}>{e}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {activeSub && (
        <Metric label="پرداخت بعدی" value={formatToman(activeSub.priceMinor)} hint="از کیف پول کسر می‌شود" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { color: theme.colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  planPrice: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  renew: { color: theme.colors.subtle, fontSize: 11 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  checkmark: { color: theme.colors.success, fontSize: 13, fontWeight: '800' },
  featureText: { color: theme.colors.ink, fontSize: 12 },
});
