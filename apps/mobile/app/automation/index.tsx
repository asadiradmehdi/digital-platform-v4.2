import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Metric, Section, State, Status, Title } from '../../src/components/Ui';
import { theme } from '../../src/theme';
import { useWorkspace } from '../../src/hooks/useWorkspace';
import { useQuery } from '../../src/hooks/useQuery';
import { automation } from '../../src/api/client';

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

type WorkflowItem = { id: string; name: string; status?: string; trigger?: string; runCount?: number; lastRunAt?: string };
type RunItem = { id: string; workflowId?: string; workflowName?: string; status?: string; startedAt?: string; finishedAt?: string };

function workflowTone(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'ACTIVE': case 'ENABLED': return 'success';
    case 'PAUSED': case 'DISABLED': return 'warning';
    case 'ERROR': return 'danger';
    default: return 'neutral';
  }
}

function workflowStatusLabel(status?: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'فعال', ENABLED: 'فعال', PAUSED: 'متوقف', DISABLED: 'غیرفعال', ERROR: 'خطا',
  };
  return labels[(status ?? '').toUpperCase()] ?? (status ?? 'نامشخص');
}

function runTone(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'COMPLETED': case 'SUCCESS': return 'success';
    case 'RUNNING': case 'PENDING': return 'info';
    case 'FAILED': case 'ERROR': return 'danger';
    default: return 'neutral';
  }
}

function runStatusLabel(status?: string): string {
  const labels: Record<string, string> = {
    COMPLETED: 'موفق', SUCCESS: 'موفق', RUNNING: 'در حال اجرا',
    PENDING: 'در صف', FAILED: 'خطا', ERROR: 'خطا',
  };
  return labels[(status ?? '').toUpperCase()] ?? (status ?? 'نامشخص');
}

export default function AutomationScreen() {
  const { workspaceId } = useWorkspace();
  const workflowsQ = useQuery(
    () => workspaceId ? automation.listWorkflows(workspaceId) : Promise.resolve({ items: [] }),
    [workspaceId],
  );
  const runsQ = useQuery(
    () => workspaceId ? automation.listRuns(workspaceId) : Promise.resolve({ items: [] }),
    [workspaceId],
  );

  const wfItems = (workflowsQ.data?.items ?? []) as WorkflowItem[];
  const runItems = (runsQ.data?.items ?? []) as RunItem[];
  const activeCount = wfItems.filter((w) => ['ACTIVE', 'ENABLED'].includes((w.status ?? '').toUpperCase())).length;
  const successRuns = runItems.filter((r) => ['COMPLETED', 'SUCCESS'].includes((r.status ?? '').toUpperCase())).length;

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>اتوماسیون</Text>
        <Action>+ جدید</Action>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {workflowsQ.status === 'loading' ? '…' : String(activeCount)}
          </Text>
          <Text style={styles.statLabel}>Workflow فعال</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {runsQ.status === 'loading' ? '…' : String(runItems.length)}
          </Text>
          <Text style={styles.statLabel}>کل اجراها</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>
            {runsQ.status === 'loading' ? '…' : String(successRuns)}
          </Text>
          <Text style={styles.statLabel}>موفق</Text>
        </View>
      </View>

      {/* Workflows */}
      <Card>
        <Section title="Workflowها" />
        {workflowsQ.status === 'loading' && <State loading />}
        {workflowsQ.status === 'error' && <State error={workflowsQ.error} />}
        {workflowsQ.status === 'success' && wfItems.length === 0 && (
          <State empty="Workflow تعریف نشده است." />
        )}
        {wfItems.map((wf, i) => (
          <View key={wf.id}>
            {i > 0 && <Divider />}
            <View style={styles.wfRow}>
              <View style={styles.wfLeft}>
                <View style={styles.wfNameRow}>
                  <Text style={styles.wfName} numberOfLines={1}>{wf.name}</Text>
                  <Status tone={workflowTone(wf.status)}>{workflowStatusLabel(wf.status)}</Status>
                </View>
                <Text style={styles.wfMeta}>
                  {wf.trigger ?? 'Manual'}
                  {wf.runCount != null ? ` · ${wf.runCount} اجرا` : ''}
                  {wf.lastRunAt ? ` · ${new Date(wf.lastRunAt).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })}` : ''}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </Card>

      {/* Recent runs */}
      <Card>
        <Section title="اجراهای اخیر" />
        {runsQ.status === 'loading' && <State loading />}
        {runsQ.status === 'error' && <State error={runsQ.error} />}
        {runsQ.status === 'success' && runItems.length === 0 && (
          <State empty="اجرایی وجود ندارد." />
        )}
        {runItems.slice(0, 10).map((r, i) => (
          <View key={r.id}>
            {i > 0 && <Divider />}
            <View style={styles.runRow}>
              <View style={styles.runLeft}>
                <Text style={styles.runName} numberOfLines={1}>{r.workflowName ?? r.workflowId ?? r.id}</Text>
                <Text style={styles.runTime}>
                  {r.startedAt ? new Date(r.startedAt).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </Text>
              </View>
              <Status tone={runTone(r.status)}>{runStatusLabel(r.status)}</Status>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Section title="امنیت" />
        <Text style={styles.securityNote}>
          🔐 Side effectها با Tool Grant و Audit اجرا می‌شوند. هیچ عملیاتی بدون مجوز سرور انجام نمی‌شود.
        </Text>
      </Card>
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
    paddingTop: 4,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 14,
    alignItems: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statValue: {
    color: theme.colors.ink,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.5,
  },
  statLabel: {
    color: theme.colors.muted,
    fontSize: 10,
    fontFamily: theme.typography.fa,
    textAlign: 'center',
  },

  wfRow: { paddingVertical: 12, gap: 4 },
  wfLeft: { gap: 4 },
  wfNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  wfName: { color: theme.colors.ink, fontSize: 13, fontWeight: '700', fontFamily: theme.typography.fa, flex: 1 },
  wfMeta: { color: theme.colors.subtle, fontSize: 10, fontFamily: theme.typography.fa },

  runRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 10 },
  runLeft: { flex: 1, gap: 3 },
  runName: { color: theme.colors.ink, fontSize: 12, fontWeight: '600', fontFamily: theme.typography.fa },
  runTime: { color: theme.colors.subtle, fontSize: 10, fontFamily: theme.typography.fa },

  securityNote: {
    color: theme.colors.muted,
    fontSize: 11,
    fontFamily: theme.typography.fa,
    lineHeight: 20,
  },
});
