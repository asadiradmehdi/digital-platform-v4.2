import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Action, Card, Divider, Section, State, Status, Title } from '../components/Ui';
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

function OrderRow({ order, last }: { order: OrderSummary; last: boolean }) {
  return (
    <View>
      {!last && <Divider />}
      <View style={styles.row}>
        <View style={styles.main}>
          <View style={styles.topRow}>
            <Text style={styles.code}>{order.code ?? `#${order.id.slice(0, 8).toUpperCase()}`}</Text>
            <Status tone={statusTone(order.status)}>{statusLabel(order.status)}</Status>
          </View>
          <Text style={styles.service}>{order.status}</Text>
          <View style={styles.bottomRow}>
            <Text style={styles.total}>{formatToman(order.totalMinor)}</Text>
            <Text style={styles.date}>{new Date(order.createdAt).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function OrdersScreen() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const ordersQ = useQuery(
    () => workspaceId ? orders.list(workspaceId) : Promise.resolve({ items: [], nextCursor: null }),
    [workspaceId],
  );

  const items = ordersQ.data?.items ?? [];

  return (
    <Screen>
      <Title eyebrow="COMMERCE / ORDERS" description="وضعیت، مبلغ و state سفارش‌ها از API مشترک">
        سفارش‌ها
      </Title>

      <Action>سفارش جدید</Action>

      {(wsLoading || ordersQ.status === 'loading') && <State loading />}
      {ordersQ.status === 'error' && <State error={ordersQ.error} />}

      {ordersQ.status === 'success' && items.length === 0 && (
        <State empty="سفارشی ثبت نشده است." />
      )}

      {items.length > 0 && (
        <Card>
          <Section title="سفارش‌های اخیر" />
          {items.map((o, i) => (
            <OrderRow key={o.id} order={o} last={i === items.length - 1} />
          ))}
        </Card>
      )}
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
