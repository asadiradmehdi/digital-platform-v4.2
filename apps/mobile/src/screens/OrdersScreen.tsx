import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Action, Card, Divider, Section, Status, Title } from '../components/Ui';
import { theme } from '../theme';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
const orders: { code: string; service: string; status: string; total: string; date: string; tone: Tone }[] = [
  { code: '#DP-10482', service: 'Instagram Growth', status: 'در حال پردازش', total: '۱٬۴۵۰٬۰۰۰ تومان', date: '۲ مهر', tone: 'info' },
  { code: '#DP-10477', service: 'AI Writer Pro', status: 'تکمیل شده', total: '۶٬۶۰۰٬۰۰۰ تومان', date: '۱ مهر', tone: 'success' },
  { code: '#DP-10469', service: 'AI Image Studio', status: 'در صف', total: '۴٬۲۰۰٬۰۰۰ تومان', date: '۱ مهر', tone: 'warning' },
];

export function OrdersScreen() {
  return (
    <Screen>
      <Title eyebrow="COMMERCE / ORDERS" description="وضعیت، مبلغ و state سفارش‌ها از API مشترک">
        سفارش‌ها
      </Title>

      <Action>سفارش جدید</Action>

      <Card>
        <Section title="سفارش‌های اخیر" />
        {orders.map((o, i) => (
          <View key={o.code}>
            {i > 0 && <Divider />}
            <View style={styles.row}>
              <View style={styles.main}>
                <View style={styles.topRow}>
                  <Text style={styles.code}>{o.code}</Text>
                  <Status tone={o.tone}>{o.status}</Status>
                </View>
                <Text style={styles.service}>{o.service}</Text>
                <View style={styles.bottomRow}>
                  <Text style={styles.total}>{o.total}</Text>
                  <Text style={styles.date}>{o.date}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 13 },
  main: { gap: 5 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { color: theme.colors.ink, fontWeight: '800', fontSize: 12, fontFamily: 'monospace' },
  service: { color: theme.colors.muted, fontSize: 11 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { color: theme.colors.ink, fontSize: 12, fontWeight: '700' },
  date: { color: theme.colors.subtle, fontSize: 10 },
});
