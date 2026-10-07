import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { Action, Card, Divider, Section } from '../components/Ui';
import { theme } from '../theme';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspace } from '../hooks/useWorkspace';

interface MenuItem {
  label: string;
  hint: string;
  icon: string;
  path: string;
}

const accountItems: MenuItem[] = [
  { label: 'مرکز امنیت', hint: 'MFA، دستگاه‌ها، نشست‌ها', icon: '🔐', path: '/security' },
  { label: 'اشتراک و صورت‌حساب', hint: 'پلن، تمدید، فاکتور', icon: '⭐', path: '/subscriptions' },
  { label: 'کیف پول', hint: 'موجودی، شارژ، تاریخچه', icon: '💳', path: '/wallet' },
  { label: 'اعضای Workspace', hint: 'نقش‌ها، دعوت، مجوزها', icon: '👥', path: '/workspace' },
];

const moreItems: MenuItem[] = [
  { label: 'اتوماسیون', hint: 'Workflowها و اجراهای خودکار', icon: '⚡', path: '/automation' },
  { label: 'تحلیل و گزارش', hint: 'شاخص‌ها و عملکرد', icon: '📊', path: '/analytics' },
  { label: 'پشتیبانی', hint: 'تیکت‌ها، پاسخگویی', icon: '💬', path: '/support' },
];

export function SettingsScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const { userDisplayName, workspaceName } = useWorkspace();

  const firstName = userDisplayName ? userDisplayName.split(' ')[0] : 'کاربر';
  const initials = userDisplayName
    ? userDisplayName.split(' ').map((n) => n.charAt(0)).slice(0, 2).join('')
    : 'م';

  const handleNavigate = (path: string) => {
    router.push(path as Parameters<typeof router.push>[0]);
  };

  const handleLogout = () => {
    Alert.alert(
      'خروج از حساب',
      `آیا می‌خواهید از حساب ${firstName} خارج شوید؟`,
      [
        { text: 'انصراف', style: 'cancel' },
        { text: 'خروج', style: 'destructive', onPress: signOut },
      ]
    );
  };

  return (
    <Screen>
      <Text style={styles.pageTitle}>تنظیمات</Text>

      {/* Profile Card */}
      <Card>
        <View style={styles.profileCard}>
          <View style={styles.profileGlow} />
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userDisplayName ?? 'مهدی اسدی‌راد'}</Text>
            <Text style={styles.profileEmail}>asadiradmehdi@gmail.com</Text>
            {workspaceName && (
              <View style={styles.workspaceBadge}>
                <Text style={styles.workspaceBadgeText}>{workspaceName}</Text>
              </View>
            )}
          </View>
        </View>
      </Card>

      {/* Account Menu */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>حساب و امنیت</Text>
        <Card>
          {accountItems.map((item, i) => (
            <View key={item.path}>
              {i > 0 && <Divider />}
              <View style={styles.menuRow}>
                <View style={styles.menuIconWrap}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuHint}>{item.hint}</Text>
                </View>
                <Text style={styles.menuArrow}>‹</Text>
              </View>
            </View>
          ))}
        </Card>
      </View>

      {/* More Menu */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>ابزارها</Text>
        <Card>
          {moreItems.map((item, i) => (
            <View key={item.path}>
              {i > 0 && <Divider />}
              <View style={styles.menuRow}>
                <View style={styles.menuIconWrap}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuHint}>{item.hint}</Text>
                </View>
                <Text style={styles.menuArrow}>‹</Text>
              </View>
            </View>
          ))}
        </Card>
      </View>

      {/* Logout */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>منطقه خطر</Text>
        <Action
          tone="danger"
          onPress={handleLogout}
        >
          🚪 خروج امن
        </Action>
      </View>

      <Text style={styles.versionText}>نسخه ۴.۲.۰ · Digital Platform</Text>
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

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    position: 'relative',
    overflow: 'hidden',
    paddingVertical: 4,
  },
  profileGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.accentSoft,
    top: -20,
    right: -20,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },
  profileInfo: { flex: 1, gap: 4 },
  profileName: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.3,
  },
  profileEmail: {
    color: theme.colors.muted,
    fontSize: 11,
    fontFamily: theme.typography.latin,
  },
  workspaceBadge: {
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  workspaceBadgeText: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: theme.typography.fa,
  },

  menuSection: { gap: 8 },
  menuSectionTitle: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: theme.typography.fa,
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
    minHeight: 60,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuIcon: { fontSize: 18 },
  menuContent: { flex: 1, gap: 2 },
  menuLabel: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: theme.typography.fa,
  },
  menuHint: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontFamily: theme.typography.fa,
  },
  menuArrow: {
    color: theme.colors.subtle,
    fontSize: 20,
    transform: [{ scaleX: -1 }],
  },

  versionText: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontFamily: theme.typography.fa,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
