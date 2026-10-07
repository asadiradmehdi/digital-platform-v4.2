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
const topupLabels = ['۵۰۰ هزار', '۱ میلیون', '۲ میلیون'];

const referenceTypeConfig: Record<string, { label: string; icon: string }> = {
  DEPOSIT: { label: 'افزایش موجودی', icon: '⬆️' },
  SERVICE_CHARGE: { label: 'هزینه سرویس', icon: '📦' },
  REFUND: { label: 'بازگشت وجه', icon: '↩️' },
  SUBSCRIPTION: { label: 'اشتراک', icon: '⭐' },
  TOPUP: { label: 'افزایش موجودی', icon: '⬆️' },
};

function TxRow({ tx, last }: { tx: TransactionSummary; last: boolean }) {
  const credit = tx.entries.find((e) => e.direction === 'CREDIT');
  const debit = tx.entries.find((e) => e.direction === 'DEBIT');
  const isDebit = Boolean(debit && !credit);
  const amountMinor = (credit ?? debit)?.amountMinor ?? 0;
  const cfg = referenceTypeConfig[tx.referenceType] ?? { label: tx.referenceType, icon: '💱' };

  return (
    <View>
      {!last && <Divider />}
      <View style={styles.txRow}>
        <View style={[styles.txIconWrap, { backgroundColor: isDebit ? theme.colors.dangerSoft : theme.colors.successSoft }]}>
          <Text style={styles.txIcon}>{cfg.icon}</Text>
        </View>
        <View style={styles.txLeft}>
          <Text style={styles.txLabel}>{cfg.label}</Text>
          <Text style={styles.txMeta}>
            {new Date(tx.createdAt).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, isDebit ? styles.txDebit : styles.txCredit]}>
            {isDebit ? '−' : '+'}{formatToman(amountMinor)}
          </Text>
          <Text style={styles.txCurrency}>تومان</Text>
        </View>
      </View>
    </View>
  );
}

export default function Wallet() {
  const { workspaceId } = useWorkspace();

  const walletQ = useQuery(() => wallet.getBalances(), []);
  const txQ = useQuery(
    () => workspaceId ? transactions.list(workspaceId) : Promise.resolve({ items: [], nextCursor: null }),
    [workspaceId],
  );

  const balanceMinor = walletQ.data?.items?.[0]?.balanceMinor ?? '0';
  const txItems = txQ.data?.items ?? [];

  return (
    <Screen>
      {/* Page Title */}
      <View>
        <Text style={styles.pageTitle}>کیف پول</Text>
      </View>

      {/* Balance Hero */}
      <View style={styles.balanceHero}>
        <View style={styles.balanceGlow} />
        <Text style={styles.balanceEyebrow}>موجودی قابل استفاده</Text>
        {walletQ.status === 'loading' ? (
          <Text style={styles.balanceLoading}>در حال بارگذاری...</Text>
        ) : walletQ.status === 'error' ? (
          <Text style={styles.balanceError}>خطا در دریافت موجودی</Text>
        ) : (
          <Text style={styles.balanceAmount}>{formatToman(balanceMinor)}</Text>
        )}
        <Text style={styles.balanceCurrency}>تومان</Text>
        <Text style={styles.balanceNote}>به‌روز شده از سرور · idempotent</Text>
      </View>

      {/* Top-up */}
      <View style={styles.topupSection}>
        <Text style={styles.sectionTitle}>افزایش موجودی</Text>
        <View style={styles.topupGrid}>
          {topupAmountsMinor.map((a, i) => (
            <View key={a} style={styles.topupChip}>
              <Text style={styles.topupChipLabel}>{topupLabels[i]}</Text>
              <Text style={styles.topupChipAmount}>{formatToman(a)}</Text>
            </View>
          ))}
        </View>
        <Action>شارژ کیف پول</Action>
      </View>

      {/* Transactions */}
      <View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>آخرین تراکنش‌ها</Text>
          {txItems.length > 0 && (
            <Text style={styles.sectionCount}>{txItems.length} تراکنش</Text>
          )}
        </View>

        <Card>
          {txQ.status === 'loading' && <State loading />}
          {txQ.status === 'error' && <State error={txQ.error} />}
          {txQ.status === 'success' && txItems.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyTitle}>تراکنشی ثبت نشده</Text>
              <Text style={styles.emptyDesc}>اولین شارژ را انجام دهید</Text>
            </View>
          )}
          {txItems.map((tx, i) => (
            <TxRow key={tx.id} tx={tx} last={i === txItems.length - 1} />
          ))}
        </Card>
      </View>
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

  balanceHero: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: 4,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  balanceGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -60,
    right: -50,
  },
  balanceEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontFamily: theme.typography.fa,
    fontWeight: '600',
  },
  balanceLoading: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 20,
    fontFamily: theme.typography.fa,
    marginTop: 4,
  },
  balanceError: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontFamily: theme.typography.fa,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    fontFamily: theme.typography.fa,
    marginTop: 4,
  },
  balanceCurrency: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: theme.typography.fa,
  },
  balanceNote: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: theme.typography.latin,
    marginTop: 6,
  },

  topupSection: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },
  sectionCount: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontFamily: theme.typography.fa,
  },
  topupGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  topupChip: {
    flex: 1,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  topupChipLabel: {
    color: theme.colors.muted,
    fontSize: 10,
    fontFamily: theme.typography.fa,
    fontWeight: '600',
  },
  topupChipAmount: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  txIconWrap: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txIcon: { fontSize: 18 },
  txLeft: { flex: 1, gap: 3 },
  txLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: theme.typography.fa,
  },
  txMeta: {
    color: theme.colors.subtle,
    fontSize: 10,
    fontFamily: theme.typography.fa,
  },
  txRight: { alignItems: 'flex-end', gap: 2 },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.3,
  },
  txDebit: { color: theme.colors.danger },
  txCredit: { color: theme.colors.success },
  txCurrency: {
    color: theme.colors.subtle,
    fontSize: 9,
    fontFamily: theme.typography.fa,
  },

  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.xxl,
    gap: 10,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: theme.typography.fa,
  },
  emptyDesc: {
    color: theme.colors.muted,
    fontSize: 12,
    fontFamily: theme.typography.fa,
  },
});
