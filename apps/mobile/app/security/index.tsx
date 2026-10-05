import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Card, Divider, Section, Status, Title } from '../../src/components/Ui';
import { theme } from '../../src/theme';

const sessions = [
  { id: 's1', device: 'iPhone 15 Pro', location: 'تهران، ایران', last: '۳ دقیقه پیش', current: true },
  { id: 's2', device: 'Chrome / macOS', location: 'تهران، ایران', last: '۲ ساعت پیش', current: false },
  { id: 's3', device: 'Firefox / Windows', location: 'اصفهان، ایران', last: 'دیروز', current: false },
];

const auditEvents = [
  { id: 'e1', action: 'ورود موفق', detail: 'iPhone 15 Pro', time: '۳ دقیقه پیش', tone: 'success' as const },
  { id: 'e2', action: 'تغییر رمز عبور', detail: 'Chrome / macOS', time: '۲ روز پیش', tone: 'warning' as const },
  { id: 'e3', action: 'فعال‌سازی OTP', detail: 'تنظیمات امنیتی', time: '۱ هفته پیش', tone: 'info' as const },
];

export default function SecurityCenter() {
  return (
    <Screen>
      <Title eyebrow="SECURITY / CENTER" description="تصمیم‌های حساس همیشه سمت سرور enforce می‌شوند">
        مرکز امنیت
      </Title>

      {/* Security status overview */}
      <Card>
        <Section title="وضعیت امنیتی" />
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>MFA / OTP</Text>
            <Status tone="success">فعال</Status>
          </View>
          <Divider />
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Passkey</Text>
            <Status tone="warning">غیرفعال</Status>
          </View>
          <Divider />
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>هشدار بحرانی</Text>
            <Status tone="success">ندارد</Status>
          </View>
        </View>
      </Card>

      {/* Active sessions */}
      <Card>
        <Section title="نشست‌های فعال" />
        {sessions.map((s, i) => (
          <View key={s.id}>
            {i > 0 && <Divider />}
            <View style={styles.sessionRow}>
              <View style={styles.sessionLeft}>
                <View style={styles.sessionNameRow}>
                  <Text style={styles.sessionDevice}>{s.device}</Text>
                  {s.current && <Status tone="success">فعلی</Status>}
                </View>
                <Text style={styles.sessionMeta}>{s.location} · {s.last}</Text>
              </View>
              {!s.current && (
                <Text style={styles.revokeBtn}>خروج</Text>
              )}
            </View>
          </View>
        ))}
      </Card>

      {/* Audit log */}
      <Card>
        <Section title="رویدادهای امنیتی اخیر" />
        {auditEvents.map((ev, i) => (
          <View key={ev.id}>
            {i > 0 && <Divider />}
            <View style={styles.eventRow}>
              <View style={styles.eventLeft}>
                <Text style={styles.eventAction}>{ev.action}</Text>
                <Text style={styles.eventDetail}>{ev.detail} · {ev.time}</Text>
              </View>
              <Status tone={ev.tone}>{ev.tone === 'success' ? '✓' : ev.tone === 'warning' ? '!' : 'i'}</Status>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { gap: 0 },
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
