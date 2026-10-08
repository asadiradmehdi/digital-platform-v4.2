import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Metric, Section, State, Status, Title } from '../../src/components/Ui';
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

const planConfig: Record<string, { label: string; icon: string }> = {
  free: { label: 'رایگان', icon: '🆓' },
  basic: { label: 'پایه', icon: '⚡' },
  pro: { label: 'Pro', icon: '⭐' },
  enterprise: { label: 'سازمانی', icon: '🏢' },
};

function SubscriptionCard({ sub }: { sub: SubscriptionSummary }) {
  const plan = planConfig[sub.plan] ?? { label: sub.plan, icon: '📦' };

  return (
    <View style={styles.activePlanCard}>
      <View style={styles.activePlanGlow} />
      <View style={styles.activePlanTop}>
        <View style={styles.planLeft}>
          <Text style={styles.planIcon}>{plan.icon}</Text>
          <View>
            <Text style={styles.planName}>{plan.label}</Text>
            <Text style={styles.planPrice}>{formatToman(sub.priceMinor, sub.currency)} / ماه</Text>
          </View>
        </View>
        <Status tone={statusTone(sub.status)}>{statusLabel[sub.status] ?? sub.status}</Status>
      </View>
      <View style={styles.planDivider} />
      <View style={styles.planMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>تمدید</Text>
          <Text style={styles.metaValue}>
            {new Date(sub.renewalDate).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>امکانات</Text>
          <Text style={styles.metaValue}>{sub.entitlements.length} فعال</Text>
        </View>
      </View>
      <Action tone="secondary">مدیریت پلن</Action>
    </View>
  );
}

export default function Subscriptions() {
  const subsQ = useQuery(() => subscriptions.list(), []);
  const items = subsQ.data?.items ?? [];
  const activeSub = items[0];

  return (
    <Screen>
      <Text style={styles.pageTitle}>اشتراک‌ها</Text>

      {subsQ.status === 'loading' && <State loading />}
      {subsQ.status === 'error' && <State error={subsQ.error} />}
      {subsQ.status === 'success' && items.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⭐</Text>
          <Text style={styles.emptyTitle}>اشتراکی فعال نیست</Text>
          <Text style={styles.emptyDesc}>برای دسترسی به تمام امکانات، یک پلن انتخاب کنید</Text>
          <Action>انتخاب پلن</Action>
        </View>
      )}

      {activeSub && <SubscriptionCard sub={activeSub} />}

      {activeSub && activeSub.entitlements.length > 0 && (
        <Card>
          <Section title="امکانات فعال" />
          {activeSub.entitlements.map((e, i) => (
            <View key={e}>
              {i > 0 && <Divider />}
              <View style={styles.entitlementRow}>
                <View style={styles.checkCircle}>
                  <Text style={styles.checkIcon}>✓</Text>
                </View>
                <Text style={styles.entitlementLabel}>{e}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {activeSub && (
        <Card>
          <View style={styles.nextPaymentRow}>
            <View>
              <Text style={styles.nextPaymentLabel}>پرداخت بعدی</Text>
              <Text style={styles.nextPaymentAmount}>{formatToman(activeSub.priceMinor, activeSub.currency)}</Text>
              <Text style={styles.nextPaymentCurrency}>تومان از کیف پول کسر می‌شود</Text>
            </View>
            <Text style={styles.nextPaymentIcon}>💳</Text>
          </View>
        </Card>
      )}

      {activeSub && activeSub.plan !== 'enterprise' && (
        <Action>ارتقاء پلن</Action>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    color: theme.colors.ink,
    fontSize: 26,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.5,
    paddingTop: 4,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },
  emptyDesc: {
    color: theme.colors.muted,
    fontSize: 13,
    fontFamily: theme.typography.fa,
    textAlign: 'center',
    lineHeight: 22,
  },

  activePlanCard: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: 0,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  activePlanGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -50,
    right: -40,
  },
  activePlanTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planIcon: { fontSize: 32 },
  planName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.4,
  },
  planPrice: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: theme.typography.fa,
  },
  planDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 16,
  },
  planMeta: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  metaItem: { gap: 3 },
  metaLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontFamily: theme.typography.fa,
  },
  metaValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: theme.typography.fa,
  },

  entitlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: theme.colors.success,
    fontSize: 12,
    fontWeight: '800',
  },
  entitlementLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontFamily: theme.typography.fa,
    fontWeight: '500',
  },

  nextPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextPaymentLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontFamily: theme.typography.fa,
    marginBottom: 4,
  },
  nextPaymentAmount: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.4,
  },
  nextPaymentCurrency: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontFamily: theme.typography.fa,
    marginTop: 3,
  },
  nextPaymentIcon: { fontSize: 32 },
});
