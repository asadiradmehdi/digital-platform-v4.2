import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Section, State, Status, Title } from '../../src/components/Ui';
import { theme } from '../../src/theme';
import { useWorkspace } from '../../src/hooks/useWorkspace';
import { useQuery } from '../../src/hooks/useQuery';
import { support } from '../../src/api/client';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

function ticketTone(status: string): Tone {
  switch (status.toUpperCase()) {
    case 'OPEN': return 'warning';
    case 'IN_PROGRESS': return 'info';
    case 'RESOLVED': case 'CLOSED': return 'success';
    default: return 'neutral';
  }
}

function ticketStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    OPEN: 'باز', IN_PROGRESS: 'در بررسی', RESOLVED: 'حل شده', CLOSED: 'بسته',
  };
  return labels[status.toUpperCase()] ?? status;
}

export default function Support() {
  const { workspaceId } = useWorkspace();
  const ticketsQ = useQuery(
    () => workspaceId ? support.listTickets(workspaceId) : Promise.resolve({ items: [] }),
    [workspaceId],
  );
  const items = ticketsQ.data?.items ?? [];

  return (
    <Screen>
      <Title eyebrow="SUPPORT / TICKETS" description="تیکت‌ها با Workspace scope می‌شوند">
        پشتیبانی
      </Title>

      <Action>ثبت تیکت جدید</Action>

      <Card>
        <Section title="تیکت‌های اخیر" />
        {ticketsQ.status === 'loading' && <State loading />}
        {ticketsQ.status === 'error' && <State error={ticketsQ.error} />}
        {ticketsQ.status === 'success' && items.length === 0 && (
          <State empty="تیکت پشتیبانی ثبت نشده است." />
        )}
        {items.map((t, i) => (
          <View key={t.id}>
            {i > 0 && <Divider />}
            <View style={styles.ticketRow}>
              <View style={styles.ticketLeft}>
                <Text style={styles.ticketSubject}>{t.subject}</Text>
                <Text style={styles.ticketMeta}>
                  #{t.id.slice(0, 8).toUpperCase()} · {new Date(t.createdAt).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Status tone={ticketTone(t.status)}>{ticketStatusLabel(t.status)}</Status>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Section title="ساعات پاسخگویی" />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>روزهای کاری</Text>
          <Text style={styles.infoVal}>۲–۸ ساعت</Text>
        </View>
        <Divider />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>مشترکین Pro</Text>
          <Text style={styles.infoValAccent}>اولویت بالاتر</Text>
        </View>
        <Divider />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>رخدادهای امنیتی</Text>
          <Text style={styles.infoVal}>۲۴/۷</Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ticketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 10 },
  ticketLeft: { flex: 1, gap: 3 },
  ticketSubject: { color: theme.colors.ink, fontSize: 12, fontWeight: '600' },
  ticketMeta: { color: theme.colors.subtle, fontSize: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  infoLabel: { color: theme.colors.muted, fontSize: 12 },
  infoVal: { color: theme.colors.ink, fontSize: 12, fontWeight: '600' },
  infoValAccent: { color: theme.colors.accentStrong, fontSize: 12, fontWeight: '700' },
});
