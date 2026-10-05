import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Section, Status, Title } from '../../src/components/Ui';
import { theme } from '../../src/theme';

const tickets = [
  { id: 'tk-001', subject: 'سفارش #DP-10477 تکمیل نشد', status: 'بسته', tone: 'neutral' as const, date: '۱ مهر' },
  { id: 'tk-002', subject: 'خطا در شارژ کیف پول', status: 'در بررسی', tone: 'warning' as const, date: 'امروز' },
];

export default function Support() {
  return (
    <Screen>
      <Title eyebrow="SUPPORT / TICKETS" description="تیکت‌ها با Workspace scope می‌شوند">
        پشتیبانی
      </Title>

      <Action>ثبت تیکت جدید</Action>

      {/* Open tickets */}
      <Card>
        <Section title="تیکت‌های اخیر" />
        {tickets.map((t, i) => (
          <View key={t.id}>
            {i > 0 && <Divider />}
            <View style={styles.ticketRow}>
              <View style={styles.ticketLeft}>
                <Text style={styles.ticketSubject}>{t.subject}</Text>
                <Text style={styles.ticketMeta}>{t.id} · {t.date}</Text>
              </View>
              <Status tone={t.tone}>{t.status}</Status>
            </View>
          </View>
        ))}
      </Card>

      {/* Hours */}
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
