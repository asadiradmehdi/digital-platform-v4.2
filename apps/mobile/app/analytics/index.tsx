import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { theme } from '../../src/theme';
import { useWorkspace } from '../../src/hooks/useWorkspace';
import { useQuery } from '../../src/hooks/useQuery';
import { analytics } from '../../src/api/client';
import { formatToman } from '../../src/format';

type AnalyticsResponse = { workspaceId: string; metrics: { creditMinor: string; debitMinor: string } };

function MetricCard({ label, value, currency, hint, accent, icon }: {
  label: string;
  value: string;
  currency?: string;
  hint?: string;
  accent?: boolean;
  icon: string;
}) {
  return (
    <View style={[styles.metricCard, accent && styles.metricCardAccent]}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={[styles.metricLabel, accent && styles.metricLabelAccent]}>{label}</Text>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]}>{value}</Text>
      {currency && <Text style={[styles.metricCurrency, accent && styles.metricCurrencyAccent]}>{currency}</Text>}
      {hint && <Text style={[styles.metricHint, accent && styles.metricHintAccent]}>{hint}</Text>}
    </View>
  );
}

function ProgressRow({ label, value, total, color, percent }: {
  label: string;
  value: string;
  total?: string;
  color: string;
  percent: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressInfo}>
        <Text style={styles.progressLabel}>{label}</Text>
        <View style={styles.progressValueRow}>
          <Text style={[styles.progressValue, { color }]}>{value}</Text>
          {total && <Text style={styles.progressTotal}> / {total}</Text>}
          <Text style={[styles.progressPct, { color }]}>{clamped}٪</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${clamped}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function Analytics() {
  const { workspaceId } = useWorkspace();
  const analyticsQ = useQuery(
    () => workspaceId
      ? analytics.get(workspaceId) as unknown as Promise<AnalyticsResponse>
      : Promise.resolve(null),
    [workspaceId],
  );

  const creditMinor = parseInt(analyticsQ.data?.metrics?.creditMinor ?? '0', 10);
  const debitMinor = parseInt(analyticsQ.data?.metrics?.debitMinor ?? '0', 10);
  const contribution = Math.max(0, creditMinor - debitMinor);
  const margin = creditMinor > 0 ? Math.round((contribution / creditMinor) * 100) : 0;
  const debitRatio = creditMinor > 0 ? Math.round((debitMinor / creditMinor) * 100) : 0;

  return (
    <Screen>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>تحلیل و گزارش</Text>
          <Text style={styles.pageSub}>شاخص‌های عملیاتی</Text>
        </View>

        {/* Loading */}
        {analyticsQ.status === 'loading' && (
          <View style={styles.loadingState}>
            <View style={styles.skeletonWide} />
            <View style={styles.skeletonRow}>
              <View style={styles.skeletonHalf} />
              <View style={styles.skeletonHalf} />
            </View>
          </View>
        )}

        {/* Error */}
        {analyticsQ.status === 'error' && (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>خطا در دریافت اطلاعات تحلیلی</Text>
          </View>
        )}

        {analyticsQ.status === 'success' && (
          <>
            {/* Net balance hero */}
            <View style={styles.heroCard}>
              <View style={styles.heroGlow} />
              <Text style={styles.heroLabel}>موجودی خالص</Text>
              <Text style={styles.heroValue}>{formatToman(contribution)}</Text>
              <Text style={styles.heroCurrency}>تومان</Text>
              <View style={styles.heroMarginBadge}>
                <Text style={styles.heroMarginText}>حاشیه {margin}٪</Text>
              </View>
            </View>

            {/* Credit / Debit cards */}
            <View style={styles.metricsRow}>
              <MetricCard
                label="بستانکار"
                value={formatToman(creditMinor)}
                currency="تومان"
                hint="کل واریز"
                icon="⬆️"
              />
              <MetricCard
                label="بدهکار"
                value={formatToman(debitMinor)}
                currency="تومان"
                hint="کل برداشت"
                icon="⬇️"
              />
            </View>

            {/* Distribution chart */}
            <View>
              <Text style={styles.sectionTitle}>ساختار مالی</Text>
              <View style={styles.chartCard}>
                <ProgressRow
                  label="بدهکار (برداشت)"
                  value={formatToman(debitMinor)}
                  color={theme.colors.danger}
                  percent={debitRatio}
                />
                <View style={styles.chartDivider} />
                <ProgressRow
                  label="موجودی خالص"
                  value={formatToman(contribution)}
                  color={theme.colors.success}
                  percent={margin}
                />
              </View>
            </View>

            {/* Health indicators */}
            <View>
              <Text style={styles.sectionTitle}>شاخص‌های سلامت</Text>
              <View style={styles.healthCard}>
                <View style={styles.healthRow}>
                  <View style={[styles.healthDot, { backgroundColor: margin >= 30 ? theme.colors.success : theme.colors.warning }]} />
                  <Text style={styles.healthLabel}>حاشیه سود</Text>
                  <Text style={[styles.healthValue, { color: margin >= 30 ? theme.colors.success : theme.colors.warning }]}>
                    {margin}٪
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.healthRow}>
                  <View style={[styles.healthDot, { backgroundColor: debitRatio <= 70 ? theme.colors.success : theme.colors.danger }]} />
                  <Text style={styles.healthLabel}>نسبت برداشت</Text>
                  <Text style={[styles.healthValue, { color: debitRatio <= 70 ? theme.colors.success : theme.colors.danger }]}>
                    {debitRatio}٪
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.healthRow}>
                  <View style={[styles.healthDot, { backgroundColor: theme.colors.accent }]} />
                  <Text style={styles.healthLabel}>داده‌ها از سرور</Text>
                  <Text style={[styles.healthValue, { color: theme.colors.accent }]}>به‌روز</Text>
                </View>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 3, paddingTop: 4 },
  pageTitle: {
    color: theme.colors.ink,
    fontSize: 28,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.5,
  },
  pageSub: {
    color: theme.colors.muted,
    fontSize: 12,
    fontFamily: theme.typography.fa,
  },

  loadingState: { gap: 12 },
  skeletonWide: {
    height: 140,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface3,
  },
  skeletonRow: { flexDirection: 'row', gap: 12 },
  skeletonHalf: {
    flex: 1,
    height: 100,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface3,
  },

  errorCard: {
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  errorIcon: { fontSize: 32 },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontFamily: theme.typography.fa,
    fontWeight: '600',
  },

  heroCard: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: 3,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -80,
    right: -60,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontFamily: theme.typography.fa,
  },
  heroValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -1,
    marginTop: 4,
  },
  heroCurrency: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: theme.typography.fa,
  },
  heroMarginBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    marginTop: 10,
  },
  heroMarginText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: theme.typography.fa,
  },

  metricsRow: { flexDirection: 'row', gap: 12 },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  metricCardAccent: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent,
  },
  metricIcon: { fontSize: 22, marginBottom: 4 },
  metricLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontFamily: theme.typography.fa,
  },
  metricLabelAccent: { color: theme.colors.accentStrong },
  metricValue: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.3,
  },
  metricValueAccent: { color: theme.colors.accentStrong },
  metricCurrency: {
    color: theme.colors.subtle,
    fontSize: 9,
    fontFamily: theme.typography.fa,
  },
  metricCurrencyAccent: { color: theme.colors.accent },
  metricHint: {
    color: theme.colors.subtle,
    fontSize: 10,
    fontFamily: theme.typography.fa,
  },
  metricHintAccent: { color: theme.colors.accent },

  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    marginBottom: 10,
  },
  chartCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  chartDivider: { height: 1, backgroundColor: theme.colors.line },
  progressRow: { gap: 8 },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  progressLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontFamily: theme.typography.fa,
    fontWeight: '600',
  },
  progressValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },
  progressTotal: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontFamily: theme.typography.fa,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    marginLeft: 4,
  },
  progressTrack: {
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
  },

  healthCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  divider: { height: 1, backgroundColor: theme.colors.line, marginHorizontal: 16 },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  healthLabel: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 13,
    fontFamily: theme.typography.fa,
    fontWeight: '600',
  },
  healthValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },
});
