import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Card, Divider, Metric, Section, State, Title, UsageBar } from '../../src/components/Ui';
import { theme } from '../../src/theme';
import { useWorkspace } from '../../src/hooks/useWorkspace';
import { useQuery } from '../../src/hooks/useQuery';
import { analytics } from '../../src/api/client';
import { formatToman } from '../../src/format';

type AnalyticsResponse = { workspaceId: string; metrics: { creditMinor: string; debitMinor: string } };

export default function Analytics() {
  const { workspaceId } = useWorkspace();
  const analyticsQ = useQuery(
    () => workspaceId
      ? analytics.get(workspaceId) as Promise<AnalyticsResponse>
      : Promise.resolve(null),
    [workspaceId],
  );

  const creditMinor = parseInt(analyticsQ.data?.metrics?.creditMinor ?? '0', 10);
  const debitMinor = parseInt(analyticsQ.data?.metrics?.debitMinor ?? '0', 10);
  const contribution = Math.max(0, creditMinor - debitMinor);
  const margin = creditMinor > 0 ? Math.round((contribution / creditMinor) * 100) : 0;
  const providerRatio = creditMinor > 0 ? Math.round((debitMinor / creditMinor) * 100) : 0;

  return (
    <Screen>
      <Title eyebrow="ANALYTICS / OPERATIONS" description="شاخص‌ها از رویدادهای عملیاتی سمت سرور">
        تحلیل و گزارش
      </Title>

      {analyticsQ.status === 'loading' && <State loading />}
      {analyticsQ.status === 'error' && <State error={analyticsQ.error} />}

      {analyticsQ.status === 'success' && (
        <>
          <View style={styles.row2}>
            <View style={styles.half}>
              <Metric label="بستانکار" value={formatToman(creditMinor)} hint="کل واریز" />
            </View>
            <View style={styles.half}>
              <Metric label="بدهکار" value={formatToman(debitMinor)} hint="کل برداشت" />
            </View>
          </View>

          <Metric accent label="موجودی خالص" value={formatToman(contribution)} hint="بستانکار منهای بدهکار" />

          <Card>
            <Section title="ساختار تراکنش‌ها" />
            <View>
              <View style={styles.costRow}>
                <View style={styles.costInfo}>
                  <Text style={styles.costLabel}>بدهکار (برداشت)</Text>
                  <Text style={styles.costAmt}>{formatToman(debitMinor)}</Text>
                </View>
                <View style={styles.barWrap}>
                  <UsageBar value={providerRatio} />
                </View>
                <Text style={styles.costPct}>{providerRatio}٪</Text>
              </View>
              <Divider />
              <View style={styles.costRow}>
                <View style={styles.costInfo}>
                  <Text style={styles.costLabel}>موجودی خالص</Text>
                  <Text style={styles.costAmt}>{formatToman(contribution)}</Text>
                </View>
                <View style={styles.barWrap}>
                  <UsageBar value={margin} />
                </View>
                <Text style={styles.costPct}>{margin}٪</Text>
              </View>
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row2: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  costRow: { paddingVertical: 11, gap: 6 },
  costInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costLabel: { color: theme.colors.ink, fontSize: 12, fontWeight: '600' },
  costAmt: { color: theme.colors.muted, fontSize: 10 },
  barWrap: { flex: 1 },
  costPct: { color: theme.colors.subtle, fontSize: 10, fontWeight: '700', minWidth: 28, textAlign: 'left' },
});
