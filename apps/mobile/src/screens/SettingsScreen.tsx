import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { Action, Card, Divider, Section, Title } from '../components/Ui';
import { theme } from '../theme';
import { useAuth } from '../auth/AuthProvider';

const accountLinks = [
  { label: 'پروفایل و حساب', path: '/settings/profile', hint: 'نام، ایمیل، آواتار' },
  { label: 'مرکز امنیت', path: '/security', hint: 'MFA، دستگاه‌ها، نشست‌ها' },
  { label: 'اشتراک و صورت‌حساب', path: '/subscriptions', hint: 'پلن، تمدید، فاکتور' },
  { label: 'کیف پول', path: '/wallet', hint: 'موجودی، شارژ، تاریخچه' },
];

const workspaceLinks = [
  { label: 'اعضای Workspace', path: '/workspace', hint: 'نقش‌ها، دعوت، مجوزها' },
  { label: 'پشتیبانی', path: '/support', hint: 'تیکت‌ها، پاسخگویی' },
];

export function SettingsScreen() {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <Screen>
      <Title eyebrow="ACCOUNT / SETTINGS" description="حساب، امنیت، Workspace و اشتراک">
        تنظیمات
      </Title>

      {/* Profile card */}
      <Card>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>م</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>مهدی اسدی‌راد</Text>
            <Text style={styles.profileEmail}>asadiradmehdi@gmail.com</Text>
            <Text style={styles.profilePlan}>پلن Pro · فعال</Text>
          </View>
        </View>
      </Card>

      {/* Account links */}
      <Card>
        <Section title="حساب و امنیت" />
        {accountLinks.map((link, i) => (
          <View key={link.path}>
            {i > 0 && <Divider />}
            <View style={styles.linkRow}>
              <View style={styles.linkLeft}>
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Text style={styles.linkHint}>{link.hint}</Text>
              </View>
              <Text style={styles.linkArrow}>‹</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Workspace links */}
      <Card>
        <Section title="Workspace" />
        {workspaceLinks.map((link, i) => (
          <View key={link.path}>
            {i > 0 && <Divider />}
            <View style={styles.linkRow}>
              <View style={styles.linkLeft}>
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Text style={styles.linkHint}>{link.hint}</Text>
              </View>
              <Text style={styles.linkArrow}>‹</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Logout */}
      <Action
        tone="danger"
        onPress={() =>
          Alert.alert('خروج', 'از حساب خارج می‌شوید؟', [
            { text: 'انصراف', style: 'cancel' },
            { text: 'خروج', style: 'destructive', onPress: signOut },
          ])
        }
      >
        خروج امن
      </Action>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0,
  },
  avatarText: { color: theme.colors.accentStrong, fontSize: 20, fontWeight: '800' },
  profileInfo: { flex: 1, gap: 3 },
  profileName: { color: theme.colors.ink, fontSize: 15, fontWeight: '800' },
  profileEmail: { color: theme.colors.muted, fontSize: 11 },
  profilePlan: { color: theme.colors.success, fontSize: 10, fontWeight: '700' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 10,
  },
  linkLeft: { flex: 1, gap: 3 },
  linkLabel: { color: theme.colors.ink, fontSize: 13, fontWeight: '600' },
  linkHint: { color: theme.colors.subtle, fontSize: 10 },
  linkArrow: { color: theme.colors.muted, fontSize: 18, transform: [{ scaleX: -1 }] },
});
