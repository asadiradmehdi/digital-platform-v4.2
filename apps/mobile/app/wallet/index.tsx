import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Metric, Section, State, Title } from '../../src/components/Ui';
import { theme } from '../../src/theme';
import { useWorkspace } from '../../src/hooks/useWorkspace';
import { useQuery } from '../../src/hooks/useQuery';
import { wallet, transactions } from '../../src/api/client';
import type { TransactionSummary } from '../../src/api/client';
import { formatToman } from '../../src/format';

const topupAmountsMinor = [5_000_000_0, 10_000_000_0, 20_000_000_0];

const referenceTypeLabel: Record<string, string> = {
  DEPOSIT: 'افزایش موجودی',
  SERVICE_CHARGE: 'هزینه سرویس',
  REFUND: 'بازگشت وجه',
  SUBSCRIPTION: 'اشتراک',
  TOPUP: 'افزایش موجودی',
};

function TxRow({ tx, last }: { tx: TransactionSummary; last: boolean }) {
  const credit = tx.entries.find((e) => e.direction === 'CREDIT');
  const debit = tx.entries.find((e) => e.direction === 'DEBIT');
  const isDebit = Boolean(debit && !credit);
  const amountMinor = (credit ?? debit)?.amountMinor ?? 0;
  const label = referenceTypeLabel[tx.referenceType] ?? tx.referenceType;

  return (
    <View>
      {!last && <Divider />}
      <View style={styles.txRow}>
        <View style={styles.txLeft}>
          <Text style={styles.txLabel}>{label}</Text>
          <Text style={styles.txMeta}>{isDebit ? 'بدهکار' : 'بستانکار'} · {new Date(tx.createdAt).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })}</Text>
        </View>
        <Text style={[styles.txAmount, isDebit ? styles.debit : styles.credit]}>
          {isDebit ? '−' : '+'}{formatToman(amountMinor)}
        </Text>
      </View>
    </View>
  );
}

export default function Wallet() {
  const { workspaceId } = useWorkspace();

  const walletQ = useQuery(
    () => wallet.getBalances(),
    [],
  );
  const txQ = useQuery(
    () => workspaceId ? transactions.list(workspaceId) : Promise.resolve({ items: [], nextCursor: null }),
    [workspaceId],
  );

  const balanceMinor = walletQ.data?.items?.[0]?.balanceMinor ?? '0';
  const txItems = txQ.data?.items ?? [];

  return (
    <Screen>
      <Title eyebrow="FINANCE / WALLET" description="تمام عملیات مالی با idempotency و ledger سرور انجام می‌شود">
        کیف پول
      </Title>

      {walletQ.status === 'loading' ? (
        <State loading />
      ) : walletQ.status === 'error' ? (
        <State error={walletQ.error} />
      ) : (
        <Metric accent label="موجودی قابل استفاده" value={formatToman(balanceMinor)} hint="به‌روز شده از سرور" />
      )}

      <Card>
        <Section title="افزایش موجودی" />
        <View style={styles.topupRow}>
          {topupAmountsMinor.map((a) => (
            <View key={a} style={styles.topupBtn}>
              <Text style={styles.topupText}>{formatToman(a)}</Text>
            </View>
          ))}
        </View>
        <Action>شارژ کیف پول</Action>
      </Card>

      <Card>
        <Section title="آخرین تراکنش‌ها" />
        {txQ.status === 'loading' && <State loading />}
        {txQ.status === 'error' && <State error={txQ.error} />}
        {txQ.status === 'success' && txItems.length === 0 && <State empty="تراکنشی ثبت نشده است." />}
        {txItems.map((tx, i) => (
          <TxRow key={tx.id} tx={tx} last={i === txItems.length - 1} />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topupRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  topupBtn: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface2, gap: 2 },
  topupText: { color: theme.colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  txLeft: { flex: 1, gap: 3 },
  txLabel: { color: theme.colors.ink, fontSize: 13, fontWeight: '600' },
  txMeta: { color: theme.colors.subtle, fontSize: 10 },
  txAmount: { fontSize: 13, fontWeight: '800' },
  debit: { color: theme.colors.danger },
  credit: { color: theme.colors.success },
});
