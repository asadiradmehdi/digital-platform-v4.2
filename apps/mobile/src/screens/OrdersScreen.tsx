import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { Action, Card, Divider, Section, State, Status } from '../components/Ui';
import { theme } from '../theme';
import { useWorkspace } from '../hooks/useWorkspace';
import { useQuery } from '../hooks/useQuery';
import { orders } from '../api/client';
import type { OrderSummary } from '../api/client';
import { formatToman } from '../format';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

function statusTone(status: string): Tone {
  switch (status) {
    case 'COMPLETED': return 'success';
    case 'PROCESSING': case 'PROVIDER_SUBMITTED': return 'info';
    case 'QUEUED': case 'PAID': return 'warning';
    case 'FAILED': case 'CANCELLED': return 'danger';
    default: return 'neutral';
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    COMPLETED: 'تکمیل شده',
    PROCESSING: 'در حال پردازش',
    PROVIDER_SUBMITTED: 'ارسال به Provider',
    QUEUED: 'در صف',
    PAID: 'پرداخت شده',
    FAILED: 'ناموفق',
    CANCELLED: 'لغو شده',
  };
  return labels[status] ?? status;
}

const statusAccentColor = (status: string): string => {
  const map: Record<string, string> = {
    COMPLETED: theme.colors.success,
    PROCESSING: theme.colors.accent,
    PROVIDER_SUBMITTED: theme.colors.accent,
    QUEUED: theme.colors.warning,
    PAID: theme.colors.warning,
    FAILED: theme.colors.danger,
    CANCELLED: theme.colors.danger,
  };
  return map[status] ?? theme.colors.muted;
};

function OrderRow({ order, last }: { order: OrderSummary; last: boolean }) {
  const accentColor = statusAccentColor(order.status);
  const code = order.code ?? `#${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <View>
      {!last && <Divider />}
      <View style={styles.orderCard}>
        <View style={[styles.orderAccent, { backgroundColor: accentColor }]} />
        <View style={styles.orderContent}>
          <View style={styles.orderTopRow}>
            <Text style={styles.orderCode}>{code}</Text>
            <Status tone={statusTone(order.status)}>{statusLabel(order.status)}</Status>
          </View>
          <View style={styles.orderBottomRow}>
            <View>
              <Text style={styles.orderAmount}>{formatToman(order.totalMinor)}</Text>
              <Text style={styles.orderCurrency}>تومان</Text>
            </View>
            <Text style={styles.orderDate}>
              {new Date(order.createdAt).toLocaleDateString('fa-IR', {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function OrdersScreen() {
  const router = useRouter();
  const { workspaceId, loading: wsLoading } = useWorkspace();

  const ordersQ = useQuery(
    () => workspaceId ? orders.list(workspaceId) : Promise.resolve({ items: [], nextCursor: null }),
    [workspaceId],
  );

  const items = ordersQ.data?.items ?? [];
  const activeCount = items.filter((o) =>
    ['PAID', 'QUEUED', 'PROCESSING', 'PROVIDER_SUBMITTED'].includes(o.status)
  ).length;

  const isLoading = wsLoading || ordersQ.status === 'loading';

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>سفارش‌ها</Text>
          {!isLoading && items.length > 0 && (
            <Text style={styles.pageSubtitle}>
              {items.length} سفارش · {activeCount} فعال
            </Text>
          )}
        </View>
        <Action onPress={() => router.push('/services')}>+ سفارش جدید</Action>
      </View>

      {isLoading && <State loading />}
      {ordersQ.status === 'error' && <State error={ordersQ.error} />}

      {ordersQ.status === 'success' && items.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>هنوز سفارشی ندارید</Text>
          <Text style={styles.emptyDesc}>اولین سفارش خود را از بخش خدمات ثبت کنید</Text>
          <Action onPress={() => router.push('/services')}>مشاهده خدمات</Action>
        </View>
      )}

      {!isLoading && items.length > 0 && (
        <Card>
          <Section title={`${items.length} سفارش`} />
          {items.map((o, i) => (
            <OrderRow key={o.id} order={o} last={i === items.length - 1} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pageTitle: {
    color: theme.colors.ink,
    fontSize: 26,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    color: theme.colors.muted,
    fontSize: 11,
    fontFamily: theme.typography.fa,
    marginTop: 2,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
  },
  emptyDesc: {
    color: theme.colors.muted,
    fontSize: 13,
    fontFamily: theme.typography.fa,
    textAlign: 'center',
    lineHeight: 22,
  },

  orderCard: {
    flexDirection: 'row',
    paddingVertical: 14,
  },
  orderAccent: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
    flexShrink: 0,
  },
  orderContent: {
    flex: 1,
    gap: 8,
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderCode: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  orderBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  orderAmount: {
    color: theme.colors.accentStrong,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.3,
  },
  orderCurrency: {
    color: theme.colors.muted,
    fontSize: 10,
    fontFamily: theme.typography.fa,
  },
  orderDate: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontFamily: theme.typography.fa,
  },
});
