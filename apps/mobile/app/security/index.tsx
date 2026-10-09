import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Section, State, Status, Title } from '../../src/components/Ui';
import { theme } from '../../src/theme';
import { useQuery } from '../../src/hooks/useQuery';
import { sessions, auditEvents } from '../../src/api/client';

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const auditLabelMap: Record<string, { label: string; icon: string }> = {
  USER_LOGIN: { label: 'ورود موفق', icon: '✅' },
  USER_LOGOUT: { label: 'خروج', icon: '🚪' },
  PASSWORD_CHANGE: { label: 'تغییر رمز عبور', icon: '🔑' },
  MFA_ENABLED: { label: 'فعال‌سازی ورود دومرحله‌ای', icon: '🛡️' },
  MFA_DISABLED: { label: 'غیرفعال‌سازی ورود دومرحله‌ای', icon: '⚠️' },
  SESSION_REVOKED: { label: 'خروج نشست', icon: '🚫' },
  PASSKEY_ADDED: { label: 'افزودن ورود با اثر انگشت', icon: '🔐' },
};

function auditTone(action: string): Tone {
  const a = action.toUpperCase();
  if (a.includes('LOGIN') || a.includes('PASSKEY')) return 'success';
  if (a.includes('PASSWORD') || a.includes('MFA_DISABLED')) return 'warning';
  if (a.includes('FAIL') || a.includes('REVOKE')) return 'danger';
  return 'info';
}

export default function SecurityCenter() {
  const sessionsQ = useQuery(() => sessions.list(), []);
  const auditQ = useQuery(() => auditEvents.list(), []);

  const sessionItems = sessionsQ.data?.items ?? [];
  const eventItems = auditQ.data?.items ?? [];

  return (
    <Screen>
      <Text style={styles.pageTitle}>امنیت و ورود</Text>

      {/* Security summary */}
      <Card>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: theme.colors.success }]} />
            <View>
              <Text style={styles.summaryValue}>
                {sessionsQ.status === 'loading' ? '…' : String(sessionItems.length)}
              </Text>
              <Text style={styles.summaryLabel}>نشست فعال</Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: theme.colors.accent }]} />
            <View>
              <Text style={styles.summaryValue}>
                {auditQ.status === 'loading' ? '…' : String(eventItems.length)}
              </Text>
              <Text style={styles.summaryLabel}>رویداد امنیتی</Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: theme.colors.success }]} />
            <View>
              <Text style={[styles.summaryValue, { color: theme.colors.success }]}>سالم</Text>
              <Text style={styles.summaryLabel}>وضعیت</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Active sessions */}
      <Card>
        <Section title="نشست‌های فعال" />
        {sessionsQ.status === 'loading' && <State loading />}
        {sessionsQ.status === 'error' && <State error={sessionsQ.error} />}
        {sessionsQ.status === 'success' && sessionItems.length === 0 && (
          <State empty="نشست فعالی یافت نشد." />
        )}
        {sessionItems.map((s, i) => (
          <View key={s.id}>
            {i > 0 && <Divider />}
            <View style={styles.sessionRow}>
              <View style={[styles.sessionIconWrap, s.current && styles.sessionIconWrapCurrent]}>
                <Text style={styles.sessionIcon}>
                  {s.clientType === 'mobile' ? '📱' : '💻'}
                </Text>
              </View>
              <View style={styles.sessionInfo}>
                <View style={styles.sessionNameRow}>
                  <Text style={styles.sessionDevice}>{s.deviceName}</Text>
                  {s.current && <Status tone="success">فعلی</Status>}
                </View>
                <Text style={styles.sessionMeta}>
                  {s.clientType} · {new Date(s.lastSeenAt ?? s.createdAt).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              {!s.current && <Text style={styles.revokeBtn}>خروج</Text>}
            </View>
          </View>
        ))}
      </Card>

      {/* Security actions */}
      <Card>
        <Section title="اقدامات امنیتی" />
        <View style={styles.actionRow}>
          <View style={[styles.actionIconWrap, { backgroundColor: theme.colors.accentSoft }]}>
            <Text style={styles.actionIcon}>🔑</Text>
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionLabel}>تغییر رمز عبور</Text>
            <Text style={styles.actionHint}>یک عبارت بلند و به‌یادماندنی</Text>
          </View>
          <Text style={styles.actionArrow}>‹</Text>
        </View>
        <Divider />
        <View style={styles.actionRow}>
          <View style={[styles.actionIconWrap, { backgroundColor: theme.colors.successSoft }]}>
            <Text style={styles.actionIcon}>🛡️</Text>
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionLabel}>احراز هویت دو مرحله‌ای</Text>
            <Text style={styles.actionHint}>با کد یک‌بارمصرف</Text>
          </View>
          <Text style={styles.actionArrow}>‹</Text>
        </View>
        <Divider />
        <View style={styles.actionRow}>
          <View style={[styles.actionIconWrap, { backgroundColor: theme.colors.warningSoft }]}>
            <Text style={styles.actionIcon}>🔐</Text>
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionLabel}>ورود با اثر انگشت یا چهره</Text>
            <Text style={styles.actionHint}>ورود بدون رمز عبور</Text>
          </View>
          <Text style={styles.actionArrow}>‹</Text>
        </View>
      </Card>

      {/* Audit log */}
      <Card>
        <Section title="رویدادهای امنیتی اخیر" />
        {auditQ.status === 'loading' && <State loading />}
        {auditQ.status === 'error' && <State error={auditQ.error} />}
        {auditQ.status === 'success' && eventItems.length === 0 && (
          <State empty="رویداد امنیتی ثبت نشده است." />
        )}
        {eventItems.map((ev, i) => (
          <View key={ev.id}>
            {i > 0 && <Divider />}
            <View style={styles.auditRow}>
              <View style={styles.auditIconWrap}>
                <Text style={styles.auditIcon}>
                  {auditLabelMap[ev.action.toUpperCase()]?.icon ?? '📋'}
                </Text>
              </View>
              <View style={styles.auditMain}>
                <Text style={styles.auditLabel}>
                  {auditLabelMap[ev.action.toUpperCase()]?.label ?? 'فعالیت حساب'}
                </Text>
                <Text style={styles.auditMeta}>
                  {ev.entityType} · {new Date(ev.createdAt).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Status tone={auditTone(ev.action)}>
                {auditTone(ev.action) === 'success' ? '✓' : auditTone(ev.action) === 'warning' ? '!' : 'i'}
              </Status>
            </View>
          </View>
        ))}
      </Card>
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

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryValue: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },
  summaryLabel: {
    color: theme.colors.muted,
    fontSize: 10,
    fontFamily: theme.typography.fa,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.line,
    marginHorizontal: 8,
  },

  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  sessionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionIconWrapCurrent: { backgroundColor: theme.colors.accentSoft },
  sessionIcon: { fontSize: 20 },
  sessionInfo: { flex: 1, gap: 4 },
  sessionNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionDevice: { color: theme.colors.ink, fontSize: 12, fontWeight: '700', fontFamily: theme.typography.fa, flex: 1 },
  sessionMeta: { color: theme.colors.subtle, fontSize: 10, fontFamily: theme.typography.fa },
  revokeBtn: { color: theme.colors.danger, fontSize: 11, fontWeight: '700', fontFamily: theme.typography.fa },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
    minHeight: 56,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionIcon: { fontSize: 18 },
  actionContent: { flex: 1, gap: 2 },
  actionLabel: { color: theme.colors.ink, fontSize: 13, fontWeight: '600', fontFamily: theme.typography.fa },
  actionHint: { color: theme.colors.subtle, fontSize: 10, fontFamily: theme.typography.fa },
  actionArrow: { color: theme.colors.subtle, fontSize: 20, transform: [{ scaleX: -1 }] },

  auditRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12 },
  auditIconWrap: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  auditIcon: { fontSize: 16 },
  auditMain: { flex: 1, gap: 3 },
  auditLabel: { color: theme.colors.ink, fontSize: 12, fontWeight: '600', fontFamily: theme.typography.fa },
  auditMeta: { color: theme.colors.subtle, fontSize: 10, fontFamily: theme.typography.fa },
});
