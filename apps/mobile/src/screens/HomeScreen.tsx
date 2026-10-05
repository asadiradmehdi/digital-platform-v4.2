import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Action, Card, Metric, Section, Status, Title } from '../components/Ui';
import { theme } from '../theme';

export function HomeScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.glow} />
        <View style={styles.heroTop}>
          <Status tone="success">Operational</Status>
          <Text style={styles.kicker}>WORKSPACE / OVERVIEW</Text>
        </View>
        <Title description="مرکز کنترل AI، سرویس‌ها، سفارش‌ها و عملیات شما">
          صبح بخیر، اسد.
        </Title>
        <Text style={styles.heroNote}>مهم‌ترین وضعیت‌های امروز، بدون شلوغی.</Text>
        <View style={styles.heroActions}>
          <Action onPress={() => router.push('/ai')}>شروع با AI</Action>
          <Action tone="secondary" onPress={() => router.push('/services')}>سفارش جدید</Action>
        </View>
      </View>

      <View style={styles.grid}>
        <Metric accent label="موجودی کیف پول" value="۱۲٬۵۰۰٬۰۰۰ تومان" hint="قابل استفاده" />
        <Metric label="مصرف AI" value="۶۸٪" hint="از اعتبار دوره" />
      </View>

      <Card>
        <Section title="دسترسی سریع" />
        <View style={styles.actionGrid}>
          <View style={styles.actionCol}>
            <Action tone="secondary" onPress={() => router.push('/wallet')}>کیف پول</Action>
            <Action tone="secondary" onPress={() => router.push('/analytics')}>آنالیتیکس</Action>
            <Action tone="secondary" onPress={() => router.push('/support')}>پشتیبانی</Action>
          </View>
          <View style={styles.actionCol}>
            <Action tone="secondary" onPress={() => router.push('/subscriptions')}>اشتراک‌ها</Action>
            <Action tone="secondary" onPress={() => router.push('/automation')}>اتوماسیون</Action>
            <Action tone="secondary" onPress={() => router.push('/security')}>امنیت</Action>
          </View>
        </View>
      </Card>

      <Card>
        <Section title="وضعیت امروز" />
        <View style={styles.statusRow}>
          <Text style={styles.muted}>۳ سفارش فعال</Text>
          <Text style={styles.muted}>۱ اشتراک فعال</Text>
          <Status tone="success">امنیت سالم</Status>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.lineStrong,
    borderRadius: 26,
    padding: 22,
    gap: 13,
  },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: theme.colors.accentSoft,
    top: -120,
    right: -80,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: theme.colors.subtle, fontSize: 8, letterSpacing: 1.3, fontWeight: '800' },
  heroNote: { color: theme.colors.muted, fontSize: 12, lineHeight: 21 },
  heroActions: { flexDirection: 'row', gap: 9 },
  grid: { gap: 12 },
  actionGrid: { flexDirection: 'row', gap: 9 },
  actionCol: { flex: 1, gap: 9 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  muted: { color: theme.colors.muted, fontSize: 11 },
});
