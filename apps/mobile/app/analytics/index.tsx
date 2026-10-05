import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Card, Divider, Metric, Section, Title, UsageBar } from '../../src/components/Ui';
import { theme } from '../../src/theme';

const costs = [
  { label: 'هزینه Provider', pct: 36, display: '۱٬۷۳۰٬۰۰۰ تومان' },
  { label: 'هزینه پرداخت', pct: 2, display: '۸۵٬۰۰۰ تومان' },
  { label: 'استرداد', pct: 2.5, display: '۱۲۰٬۰۰۰ تومان' },
];

export default function Analytics() {
  return (
    <Screen>
      <Title eyebrow="ANALYTICS / OPERATIONS" description="شاخص‌ها از رویدادهای عملیاتی سمت سرور">
        تحلیل و گزارش
      </Title>

      <View style={styles.row2}>
        <View style={styles.half}>
          <Metric label="Revenue این ماه" value="۴٬۸۶۰٬۰۰۰" hint="تومان" />
        </View>
        <View style={styles.half}>
          <Metric label="کاربران فعال" value="۱٬۲۴۰" hint="این ماه" />
        </View>
      </View>

      <View style={styles.row2}>
        <View style={styles.half}>
          <Metric label="MRR" value="۱٬۸۹۰٬۰۰۰" hint="تومان" />
        </View>
        <View style={styles.half}>
          <Metric label="سفارش‌های فعال" value="۳" hint="در حال پردازش" />
        </View>
      </View>

      <Card>
        <Section title="ساختار هزینه (از Revenue)" />
        {costs.map((c, i) => (
          <View key={c.label}>
            {i > 0 && <Divider />}
            <View style={styles.costRow}>
              <View style={styles.costInfo}>
                <Text style={styles.costLabel}>{c.label}</Text>
                <Text style={styles.costAmt}>{c.display}</Text>
              </View>
              <View style={styles.barWrap}>
                <UsageBar value={c.pct * 2} />
              </View>
              <Text style={styles.costPct}>{c.pct}٪</Text>
            </View>
          </View>
        ))}
      </Card>

      <Metric accent label="حاشیه مشارکت" value="۶۰٪" hint="Contribution ÷ Revenue" />
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
