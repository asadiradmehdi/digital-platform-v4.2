import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Action, Card, Metric, Section, State, Status, Title, UsageBar } from '../components/Ui';
import { theme } from '../theme';
import { useQuery } from '../hooks/useQuery';
import { subscriptions } from '../api/client';

const planLabel: Record<string, string> = { free: 'رایگان', basic: 'پایه', pro: 'Pro', enterprise: 'سازمانی' };

export function AIScreen() {
  const subsQ = useQuery(() => subscriptions.list(), []);
  const activeSub = subsQ.data?.items?.find((s) => ['ACTIVE', 'TRIALING'].includes(s.status));
  const aiEntitlement = activeSub?.entitlements.includes('ai_usage');
  const usagePct = activeSub?.usagePercent ?? 0;
  const withinLimit = usagePct < 90;

  return (
    <Screen>
      <Title eyebrow="AI WORKSPACE" description="یک محیط واحد برای ساخت، اجرا و کنترل هزینه">
        هوش مصنوعی
      </Title>

      {subsQ.status === 'loading' && <State loading />}
      {subsQ.status === 'error' && <State error={subsQ.error} />}

      {subsQ.status === 'success' && (
        <Card emphasis>
          <View style={styles.row}>
            <Section title="مصرف این دوره" />
            <Status tone={withinLimit ? 'success' : 'warning'}>
              {withinLimit ? 'در محدوده' : 'نزدیک به سقف'}
            </Status>
          </View>
          <Text style={styles.big}>{usagePct}٪</Text>
          <UsageBar value={usagePct} />
          <Text style={styles.muted}>
            {activeSub
              ? `پلن ${planLabel[activeSub.plan] ?? activeSub.plan} · AI ${aiEntitlement ? 'فعال' : 'غیرفعال'}`
              : 'اشتراک فعالی وجود ندارد'}
          </Text>
        </Card>
      )}

      <Card>
        <Section title="شروع سریع" />
        <View style={styles.tool}>
          <View>
            <Text style={styles.toolTitle}>AI Writer</Text>
            <Text style={styles.muted}>نوشتن و بازنویسی محتوا</Text>
          </View>
          <Status tone="info">Ready</Status>
        </View>
        <View style={styles.tool}>
          <View>
            <Text style={styles.toolTitle}>Research</Text>
            <Text style={styles.muted}>تحقیق و تحلیل موضوع</Text>
          </View>
          <Status tone="info">Ready</Status>
        </View>
        <Action>شروع یک درخواست</Action>
      </Card>

      <Card>
        <Section title="کنترل هزینه" />
        <Text style={styles.muted}>
          هزینه Provider، Tokenها و بودجه سمت سرور محاسبه و کنترل می‌شوند. هیچ اطلاعات Provider در اپلیکیشن ذخیره نمی‌شود.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  big: { color: theme.colors.accentStrong, fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  muted: { color: theme.colors.muted, fontSize: 11, lineHeight: 20 },
  tool: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.colors.line },
  toolTitle: { color: theme.colors.ink, fontWeight: '800', fontSize: 13 },
});
