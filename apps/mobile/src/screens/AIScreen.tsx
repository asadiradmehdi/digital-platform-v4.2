import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Action, Card, Section, State, Status, UsageBar } from '../components/Ui';
import { theme } from '../theme';
import { useQuery } from '../hooks/useQuery';
import { subscriptions } from '../api/client';

const planLabel: Record<string, string> = {
  free: 'رایگان',
  basic: 'پایه',
  pro: 'Pro',
  enterprise: 'سازمانی',
};

const aiTools = [
  { id: 'writer', name: 'AI Writer', desc: 'نوشتن و بازنویسی محتوا', icon: '✍️' },
  { id: 'research', name: 'Research', desc: 'تحقیق و تحلیل موضوع', icon: '🔬' },
  { id: 'image', name: 'Image Studio', desc: 'تولید تصویر با AI', icon: '🖼️' },
  { id: 'translate', name: 'Translator', desc: 'ترجمه حرفه‌ای چند زبانه', icon: '🌐' },
];

export function AIScreen() {
  const subsQ = useQuery(() => subscriptions.list(), []);
  const activeSub = subsQ.data?.items?.find((s) => ['ACTIVE', 'TRIALING'].includes(s.status));
  const aiEntitlement = activeSub?.entitlements.includes('ai_usage');
  const usagePct = activeSub?.usagePercent ?? 0;
  const withinLimit = usagePct < 80;

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>هوش مصنوعی</Text>
        <Text style={styles.pageSub}>AI Workspace</Text>
      </View>

      {subsQ.status === 'loading' && <State loading />}
      {subsQ.status === 'error' && <State error={subsQ.error} />}

      {subsQ.status === 'success' && (
        <Card emphasis>
          <View style={styles.usageTop}>
            <View style={styles.usageLeft}>
              <Text style={styles.usagePlanName}>
                {activeSub ? `پلن ${planLabel[activeSub.plan] ?? activeSub.plan}` : 'بدون اشتراک'}
              </Text>
              <View style={[styles.aiBadge, { backgroundColor: aiEntitlement ? theme.colors.successSoft : theme.colors.surface3 }]}>
                <View style={[styles.aiBadgeDot, { backgroundColor: aiEntitlement ? theme.colors.success : theme.colors.muted }]} />
                <Text style={[styles.aiBadgeText, { color: aiEntitlement ? theme.colors.success : theme.colors.muted }]}>
                  {aiEntitlement ? 'AI فعال' : 'AI غیرفعال'}
                </Text>
              </View>
              <Text style={styles.usageDesc}>
                {withinLimit ? 'مصرف در محدوده مجاز' : 'نزدیک به سقف مصرف'}
              </Text>
              {activeSub && (
                <Text style={styles.renewDate}>
                  تمدید: {new Date(activeSub.renewalDate).toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' })}
                </Text>
              )}
            </View>
            <View style={styles.usageRing}>
              <View style={[styles.ringOuter, { borderColor: withinLimit ? theme.colors.accent : theme.colors.warning }]}>
                <View style={[styles.ringInner, { backgroundColor: withinLimit ? theme.colors.accentSoft : theme.colors.warningSoft }]}>
                  <Text style={[styles.ringPct, { color: withinLimit ? theme.colors.accent : theme.colors.warning }]}>
                    {usagePct}٪
                  </Text>
                  <Text style={styles.ringLabel}>مصرف</Text>
                </View>
              </View>
            </View>
          </View>

          {activeSub && (
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>مصرف این دوره</Text>
                <Text style={[styles.progressPct, { color: withinLimit ? theme.colors.accent : theme.colors.warning }]}>
                  {usagePct}٪
                </Text>
              </View>
              <UsageBar value={usagePct} />
            </View>
          )}
        </Card>
      )}

      {/* AI Tools */}
      <View style={styles.sectionHeader}>
        <Section title="ابزارهای AI" />
        <Status tone="success">همه آماده</Status>
      </View>

      <View style={styles.toolsGrid}>
        {aiTools.map((tool) => (
          <View key={tool.id} style={styles.toolCard}>
            <Text style={styles.toolIcon}>{tool.icon}</Text>
            <Text style={styles.toolName}>{tool.name}</Text>
            <Text style={styles.toolDesc}>{tool.desc}</Text>
          </View>
        ))}
      </View>

      <Action>شروع یک درخواست جدید</Action>

      {/* Security note */}
      <Card>
        <Section title="کنترل هزینه" />
        <Text style={styles.securityText}>
          🔐 هزینه Provider، توکن‌ها و بودجه سمت سرور محاسبه می‌شوند. هیچ Secret در اپلیکیشن ذخیره نیست.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  pageTitle: {
    color: theme.colors.ink,
    fontSize: 26,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.5,
  },
  pageSub: {
    color: theme.colors.muted,
    fontSize: 12,
    fontFamily: theme.typography.latin,
    letterSpacing: 0.5,
  },

  usageTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  usageLeft: { flex: 1, gap: 8 },
  usagePlanName: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.3,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  aiBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: theme.typography.fa,
  },
  usageDesc: {
    color: theme.colors.muted,
    fontSize: 12,
    fontFamily: theme.typography.fa,
    lineHeight: 20,
  },
  renewDate: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontFamily: theme.typography.fa,
  },
  usageRing: { padding: 8 },
  ringOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  ringPct: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },
  ringLabel: {
    color: theme.colors.subtle,
    fontSize: 9,
    fontFamily: theme.typography.fa,
  },

  progressSection: { gap: 8, marginTop: 8 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontFamily: theme.typography.fa,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toolCard: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  toolIcon: { fontSize: 28 },
  toolName: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: theme.typography.latin,
  },
  toolDesc: {
    color: theme.colors.muted,
    fontSize: 11,
    fontFamily: theme.typography.fa,
    lineHeight: 18,
  },

  securityText: {
    color: theme.colors.muted,
    fontSize: 11,
    fontFamily: theme.typography.fa,
    lineHeight: 20,
  },
});
