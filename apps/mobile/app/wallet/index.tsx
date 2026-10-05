import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Metric, Section, Title } from '../../src/components/Ui';
import { theme } from '../../src/theme';

const transactions = [
  { id: 'tx-1', label: 'AI Writer Pro', type: 'بدهکار', amount: '−۶٬۶۰۰٬۰۰۰', date: '۲ مهر', debit: true },
  { id: 'tx-2', label: 'افزایش موجودی', type: 'بستانکار', amount: '+۱۰٬۰۰۰٬۰۰۰', date: '۱ مهر', debit: false },
  { id: 'tx-3', label: 'Instagram Growth', type: 'بدهکار', amount: '−۲٬۹۰۰٬۰۰۰', date: '۱ مهر', debit: true },
];

const topupAmounts = ['۵٬۰۰۰٬۰۰۰', '۱۰٬۰۰۰٬۰۰۰', '۲۰٬۰۰۰٬۰۰۰'];

export default function Wallet() {
  return (
    <Screen>
      <Title eyebrow="FINANCE / WALLET" description="تمام عملیات مالی با idempotency و ledger سرور انجام می‌شود">
        کیف پول
      </Title>

      <Metric accent label="موجودی قابل استفاده" value="۱۲٬۵۰۰٬۰۰۰ تومان" hint="به‌روز شده از سرور" />

      {/* Topup */}
      <Card>
        <Section title="افزایش موجودی" />
        <View style={styles.topupRow}>
          {topupAmounts.map(a => (
            <View key={a} style={styles.topupBtn}>
              <Text style={styles.topupText}>{a}</Text>
              <Text style={styles.topupSub}>تومان</Text>
            </View>
          ))}
        </View>
        <Action>شارژ کیف پول</Action>
      </Card>

      {/* Transactions */}
      <Card>
        <Section title="آخرین تراکنش‌ها" />
        {transactions.map((tx, i) => (
          <View key={tx.id}>
            {i > 0 && <Divider />}
            <View style={styles.txRow}>
              <View style={styles.txLeft}>
                <Text style={styles.txLabel}>{tx.label}</Text>
                <Text style={styles.txMeta}>{tx.type} · {tx.date}</Text>
              </View>
              <Text style={[styles.txAmount, tx.debit ? styles.debit : styles.credit]}>
                {tx.amount}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topupRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  topupBtn: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface2, gap: 2 },
  topupText: { color: theme.colors.ink, fontSize: 13, fontWeight: '800' },
  topupSub: { color: theme.colors.muted, fontSize: 9 },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  txLeft: { flex: 1, gap: 3 },
  txLabel: { color: theme.colors.ink, fontSize: 13, fontWeight: '600' },
  txMeta: { color: theme.colors.subtle, fontSize: 10 },
  txAmount: { fontSize: 14, fontWeight: '800' },
  debit: { color: theme.colors.danger },
  credit: { color: theme.colors.success },
});
