import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Card, Divider, Section, State, Status, Title } from '../../src/components/Ui';
import { theme } from '../../src/theme';
import { useQuery } from '../../src/hooks/useQuery';
import { sessions, auditEvents } from '../../src/api/client';

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

function auditTone(action: string): Tone {
  if (action.includes('LOGIN') || action.includes('SESSION')) return 'success';
  if (action.includes('PASSWORD') || action.includes('MFA')) return 'warning';
  if (action.includes('FAIL') || action.includes('REVOKE')) return 'danger';
  return 'info';
}

function auditLabel(action: string): string {
  const labels: Record<string, string> = {
    USER_LOGIN: 'ورود موفق',
    USER_LOGOUT: 'خروج',
    PASSWORD_CHANGE: 'تغییر رمز عبور',
    MFA_ENABLED: 'فعال‌سازی OTP',
    MFA_DISABLED: 'غیرفعال‌سازی OTP',
    SESSION_REVOKED: 'خروج نشست',
    PASSKEY_ADDED: 'افزودن Passkey',
  };
  return labels[action.toUpperCase()] ?? action;
}

export default function SecurityCenter() {
  const sessionsQ = useQuery(() => sessions.list(), []);
  const auditQ = useQuery(() => auditEvents.list(), []);

  const sessionItems = sessionsQ.data?.items ?? [];
  const eventItems = auditQ.data?.items ?? [];

  return (
    <Screen>
      <Title eyebrow="SECURITY / CENTER" description="تصمیم‌های حساس همیشه سمت سرور enforce می‌شوند">
        مرکز امنیت
      </Title>

      <Card>
        <Section title="وضعیت امنیتی" />
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>نشست‌های فعال</Text>
          <Status tone={sessionItems.length > 0 ? 'success' : 'neutral'}>
            {sessionsQ.status === 'loading' ? '…' : String(sessionItems.length)}
          </Status>
        </View>
        <Divider />
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>رویدادهای امنیتی</Text>
          <Status tone={eventItems.length > 0 ? 'info' : 'neutral'}>
            {auditQ.status === 'loading' ? '…' : String(eventItems.length)}
          </Status>
        </View>
      </Card>

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
              <View style={styles.sessionLeft}>
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
            <View style={styles.eventRow}>
              <View style={styles.eventLeft}>
                <Text style={styles.eventAction}>{auditLabel(ev.action)}</Text>
                <Text style={styles.eventDetail}>
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
  statusItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  statusLabel: { color: theme.colors.muted, fontSize: 12 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 10 },
  sessionLeft: { flex: 1, gap: 3 },
  sessionNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionDevice: { color: theme.colors.ink, fontSize: 12, fontWeight: '700' },
  sessionMeta: { color: theme.colors.subtle, fontSize: 10 },
  revokeBtn: { color: theme.colors.danger, fontSize: 11, fontWeight: '700' },
  eventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, gap: 10 },
  eventLeft: { flex: 1, gap: 3 },
  eventAction: { color: theme.colors.ink, fontSize: 12, fontWeight: '600' },
  eventDetail: { color: theme.colors.subtle, fontSize: 10 },
});
