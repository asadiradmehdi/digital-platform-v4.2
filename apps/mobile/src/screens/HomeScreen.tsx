import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Action, Card, Divider, Section, State, Status } from '../components/Ui';
import { theme } from '../theme';
import { useWorkspace } from '../hooks/useWorkspace';
import { useQuery } from '../hooks/useQuery';
import { wallet, orders, subscriptions } from '../api/client';
import { formatToman } from '../format';

function getPersianDate(): string {
  return new Date().toLocaleDateString('fa-IR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

type OrderItem = { id: string; code?: string | null; status: string; totalMinor: number; createdAt: string };

function RecentOrderRow({ order, last }: { order: OrderItem; last: boolean }) {
  const statusColors: Record<string, string> = {
    COMPLETED: theme.colors.success,
    PROCESSING: theme.colors.accent,
    PROVIDER_SUBMITTED: theme.colors.accent,
    QUEUED: theme.colors.warning,
    PAID: theme.colors.warning,
    FAILED: theme.colors.danger,
    CANCELLED: theme.colors.danger,
  };
  const statusLabels: Record<string, string> = {
    COMPLETED: 'تکمیل شده',
    PROCESSING: 'در پردازش',
    PROVIDER_SUBMITTED: 'ارسال شده',
    QUEUED: 'در صف',
    PAID: 'پرداخت شده',
    FAILED: 'ناموفق',
    CANCELLED: 'لغو شده',
  };

  const dotColor = statusColors[order.status] ?? theme.colors.muted;
  const label = statusLabels[order.status] ?? order.status;
  const code = order.code ?? `#${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <View>
      {!last && <Divider />}
      <View style={styles.orderRow}>
        <View style={[styles.orderDot, { backgroundColor: dotColor }]} />
        <View style={styles.orderMain}>
          <Text style={styles.orderCode}>{code}</Text>
          <Text style={styles.orderStatus}>{label}</Text>
        </View>
        <View style={styles.orderRight}>
          <Text style={styles.orderAmount}>{formatToman(order.totalMinor)}</Text>
          <Text style={styles.orderDate}>
            {new Date(order.createdAt).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const { workspaceId, userDisplayName, loading: wsLoading } = useWorkspace();

  const walletQ = useQuery(
    () => workspaceId ? wallet.getBalances() : Promise.resolve({ items: [] }),
    [workspaceId],
  );
  const ordersQ = useQuery(
    () => workspaceId ? orders.list(workspaceId) : Promise.resolve({ items: [], nextCursor: null }),
    [workspaceId],
  );
  const subsQ = useQuery(
    () => subscriptions.list(),
    [],
  );

  const balanceMinor = walletQ.data?.items?.[0]?.balanceMinor ?? '0';
  const allOrders = ordersQ.data?.items ?? [];
  const recentOrders = allOrders.slice(0, 3);
  const activeOrders = allOrders.filter(
    (o) => ['PAID', 'QUEUED', 'PROCESSING', 'PROVIDER_SUBMITTED'].includes(o.status),
  ).length;
  const activeSubs = subsQ.data?.items?.filter(
    (s) => ['ACTIVE', 'TRIALING'].includes(s.status),
  ).length ?? 0;

  const firstName = userDisplayName ? userDisplayName.split(' ')[0] : null;

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>
            {wsLoading ? 'در حال بارگذاری...' : firstName ? `سلام، ${firstName}` : 'سلام'}
          </Text>
          <Text style={styles.date}>{getPersianDate()}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {firstName ? firstName.charAt(0) : 'م'}
          </Text>
        </View>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceGlow} />
        <Text style={styles.balanceEyebrow}>موجودی کیف پول</Text>
        {walletQ.status === 'loading' ? (
          <Text style={styles.balanceLoading}>در حال بارگذاری...</Text>
        ) : walletQ.status === 'error' ? (
          <Text style={styles.balanceError}>خطا در دریافت موجودی</Text>
        ) : (
          <Text style={styles.balanceAmount}>{formatToman(balanceMinor)}</Text>
        )}
        <Text style={styles.balanceCurrency}>تومان</Text>
        <View style={styles.balanceStats}>
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatValue}>{activeOrders}</Text>
            <Text style={styles.balanceStatLabel}>سفارش فعال</Text>
          </View>
          <View style={styles.balanceStatDivider} />
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatValue}>{activeSubs}</Text>
            <Text style={styles.balanceStatLabel}>اشتراک فعال</Text>
          </View>
          <View style={styles.balanceStatDivider} />
          <View style={styles.balanceStat}>
            <View style={styles.statusDot} />
            <Text style={styles.balanceStatLabel}>سیستم سالم</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>دسترسی سریع</Text>
      </View>
      <View style={styles.quickActionsGrid}>
        <View style={[styles.quickAction, styles.quickActionAccent]}>
          <Text style={styles.quickActionIcon}>📦</Text>
          <Action onPress={() => router.push('/services')}>سفارش جدید</Action>
        </View>
        <View style={styles.quickAction}>
          <Text style={styles.quickActionIcon}>✨</Text>
          <Action tone="secondary" onPress={() => router.push('/ai')}>هوش مصنوعی</Action>
        </View>
      </View>

      <View style={styles.actionGrid}>
        <View style={styles.actionCol}>
          <Action tone="secondary" onPress={() => router.push('/wallet')}>💳 کیف پول</Action>
          <Action tone="secondary" onPress={() => router.push('/analytics')}>📊 آنالیتیکس</Action>
        </View>
        <View style={styles.actionCol}>
          <Action tone="secondary" onPress={() => router.push('/subscriptions')}>⭐ اشتراک‌ها</Action>
          <Action tone="secondary" onPress={() => router.push('/security')}>🔐 امنیت</Action>
        </View>
      </View>

      {/* Recent Orders */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>سفارش‌های اخیر</Text>
        <Action tone="ghost" onPress={() => router.push('/orders')}>مشاهده همه</Action>
      </View>

      <Card>
        {(wsLoading || ordersQ.status === 'loading') && <State loading />}
        {ordersQ.status === 'error' && <State error={ordersQ.error} />}
        {ordersQ.status === 'success' && recentOrders.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>هنوز سفارشی ندارید</Text>
            <Text style={styles.emptyDesc}>اولین سفارش خود را ثبت کنید</Text>
            <Action onPress={() => router.push('/services')}>مشاهده خدمات</Action>
          </View>
        )}
        {recentOrders.map((o, i) => (
          <RecentOrderRow key={o.id} order={o} last={i === recentOrders.length - 1} />
        ))}
      </Card>

      {/* Today's status */}
      <Card>
        <Section title="وضعیت امروز" />
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={styles.statusValue}>{activeOrders}</Text>
            <Text style={styles.statusLabel}>سفارش فعال</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={styles.statusValue}>{activeSubs}</Text>
            <Text style={styles.statusLabel}>اشتراک فعال</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Status tone="success">سالم</Status>
            <Text style={styles.statusLabel}>امنیت</Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  headerLeft: { gap: 2 },
  greeting: {
    color: theme.colors.ink,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.5,
  },
  date: {
    color: theme.colors.muted,
    fontSize: 11,
    fontFamily: theme.typography.fa,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },

  balanceCard: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: 4,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  balanceGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -80,
    right: -60,
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
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    fontFamily: theme.typography.fa,
    marginTop: 4,
  },
  balanceCurrency: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontFamily: theme.typography.fa,
    marginBottom: 8,
  },
  balanceStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  balanceStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  balanceStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },
  balanceStatLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontFamily: theme.typography.fa,
  },
  balanceStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },

  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quickActionAccent: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent,
  },
  quickActionIcon: { fontSize: 24 },

  actionGrid: { flexDirection: 'row', gap: 12 },
  actionCol: { flex: 1, gap: 10 },

  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  orderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  orderMain: { flex: 1, gap: 3 },
  orderCode: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  orderStatus: {
    color: theme.colors.muted,
    fontSize: 10,
    fontFamily: theme.typography.fa,
  },
  orderRight: { alignItems: 'flex-end', gap: 3 },
  orderAmount: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: theme.typography.fa,
  },
  orderDate: {
    color: theme.colors.subtle,
    fontSize: 10,
    fontFamily: theme.typography.fa,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
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

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statusItem: { flex: 1, alignItems: 'center', gap: 4 },
  statusValue: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },
  statusLabel: {
    color: theme.colors.muted,
    fontSize: 10,
    fontFamily: theme.typography.fa,
  },
  statusDivider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.line,
  },
});
