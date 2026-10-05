import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Metric, Section, Status, Title } from '../../src/components/Ui';
import { theme } from '../../src/theme';

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const workflows = [
  {
    id: 'wf-001',
    name: 'گزارش روزانه Analytics',
    trigger: 'زمان‌بندی',
    lastRun: '۶ ساعت پیش',
    runs: '۴۲',
    status: 'فعال',
    tone: 'success' as Tone,
  },
  {
    id: 'wf-002',
    name: 'اطلاع‌رسانی سفارش جدید',
    trigger: 'Webhook',
    lastRun: '۲ دقیقه پیش',
    runs: '۱۲۸',
    status: 'فعال',
    tone: 'success' as Tone,
  },
  {
    id: 'wf-003',
    name: 'پشتیبان‌گیری داده کاربر',
    trigger: 'زمان‌بندی',
    lastRun: '۱ روز پیش',
    runs: '۷',
    status: 'متوقف',
    tone: 'warning' as Tone,
  },
];

const recentRuns = [
  { id: 'r1', name: 'اطلاع‌رسانی سفارش جدید', result: 'موفق', time: '۲ دقیقه پیش', tone: 'success' as Tone },
  { id: 'r2', name: 'اطلاع‌رسانی سفارش جدید', result: 'موفق', time: '۱۵ دقیقه پیش', tone: 'success' as Tone },
  { id: 'r3', name: 'گزارش روزانه Analytics', result: 'موفق', time: '۶ ساعت پیش', tone: 'success' as Tone },
  { id: 'r4', name: 'پشتیبان‌گیری داده کاربر', result: 'خطا', time: 'دیروز', tone: 'danger' as Tone },
];

export default function AutomationScreen() {
  return (
    <Screen>
      <Title eyebrow="AUTOMATION / WORKFLOWS" description="Side effectها با Tool Grant و Audit اجرا می‌شوند">
        اتوماسیون
      </Title>

      <Action>ساخت Workflow جدید</Action>

      {/* Stats */}
      <View style={styles.row2}>
        <View style={styles.half}>
          <Metric label="Workflowهای فعال" value="۲" hint="از ۳ workflow" />
        </View>
        <View style={styles.half}>
          <Metric label="اجراهای این ماه" value="۱۷۷" hint="موفق + خطا" />
        </View>
      </View>

      {/* Workflows */}
      <Card>
        <Section title="Workflowها" />
        {workflows.map((wf, i) => (
          <View key={wf.id}>
            {i > 0 && <Divider />}
            <View style={styles.wfRow}>
              <View style={styles.wfLeft}>
                <View style={styles.wfNameRow}>
                  <Text style={styles.wfName}>{wf.name}</Text>
                  <Status tone={wf.tone}>{wf.status}</Status>
                </View>
                <Text style={styles.wfMeta}>{wf.trigger} · آخرین اجرا: {wf.lastRun} · {wf.runs} بار</Text>
              </View>
            </View>
          </View>
        ))}
      </Card>

      {/* Recent runs */}
      <Card>
        <Section title="اجراهای اخیر" />
        {recentRuns.map((r, i) => (
          <View key={r.id}>
            {i > 0 && <Divider />}
            <View style={styles.runRow}>
              <View style={styles.runLeft}>
                <Text style={styles.runName}>{r.name}</Text>
                <Text style={styles.runTime}>{r.time}</Text>
              </View>
              <Status tone={r.tone}>{r.result}</Status>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row2: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  wfRow: { paddingVertical: 12, gap: 4 },
  wfLeft: { gap: 4 },
  wfNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  wfName: { color: theme.colors.ink, fontSize: 13, fontWeight: '700', flex: 1 },
  wfMeta: { color: theme.colors.subtle, fontSize: 10 },
  runRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 10 },
  runLeft: { flex: 1, gap: 3 },
  runName: { color: theme.colors.ink, fontSize: 12, fontWeight: '600' },
  runTime: { color: theme.colors.subtle, fontSize: 10 },
});
