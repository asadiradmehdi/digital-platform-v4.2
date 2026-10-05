import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Metric, Section, Title, UsageBar } from '../../src/components/Ui';
import { theme } from '../../src/theme';

const entitlements = [
  { label: 'درخواست AI', used: 68, limit: 100, unit: '٪' },
  { label: 'ذخیره‌سازی', used: 2.1, limit: 10, unit: 'GB' },
  { label: 'Workflow اجرا', used: 12, limit: 50, unit: 'اجرا' },
];

const features = ['مسیریابی هوشمند مدل', 'اولویت پشتیبانی', 'Automation runs', 'Knowledge base', 'API sandbox'];

export default function Subscriptions() {
  return (
    <Screen>
      <Title eyebrow="BILLING / SUBSCRIPTIONS" description="Entitlementها و قیمت از سرور enforce می‌شوند">
        اشتراک‌ها
      </Title>

      {/* Plan card */}
      <Card emphasis>
        <View style={styles.planRow}>
          <View>
            <Text style={styles.planName}>Pro</Text>
            <Text style={styles.planPrice}>۱٬۸۹۰٬۰۰۰ تومان / ماه</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>فعال</Text>
          </View>
        </View>
        <Text style={styles.renew}>تمدید: ۲۸ مهر ۱۴۰۵</Text>
        <Divider />
        <Action tone="secondary">تغییر پلن</Action>
      </Card>

      {/* Usage */}
      <Card>
        <Section title="مصرف این دوره" />
        {entitlements.map((e, i) => (
          <View key={e.label}>
            {i > 0 && <Divider />}
            <View style={styles.entRow}>
              <Text style={styles.entLabel}>{e.label}</Text>
              <Text style={styles.entVal}>{e.used}/{e.limit} {e.unit}</Text>
            </View>
            <UsageBar value={(e.used / e.limit) * 100} />
          </View>
        ))}
      </Card>

      {/* Features */}
      <Card>
        <Section title="امکانات فعال" />
        {features.map((f, i) => (
          <View key={f}>
            {i > 0 && <Divider />}
            <View style={styles.featureRow}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Metric label="پرداخت بعدی" value="۱٬۸۹۰٬۰۰۰ تومان" hint="از کیف پول کسر می‌شود" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { color: theme.colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  planPrice: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  badge: { backgroundColor: theme.colors.accentSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  badgeText: { color: theme.colors.accentStrong, fontSize: 10, fontWeight: '700' },
  renew: { color: theme.colors.subtle, fontSize: 11 },
  entRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  entLabel: { color: theme.colors.ink, fontSize: 12, fontWeight: '600' },
  entVal: { color: theme.colors.muted, fontSize: 11 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  checkmark: { color: theme.colors.success, fontSize: 13, fontWeight: '800' },
  featureText: { color: theme.colors.ink, fontSize: 12 },
});
