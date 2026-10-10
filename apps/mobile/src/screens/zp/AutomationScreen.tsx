import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { appApi } from '../../api/app';
import { automation } from '../../api/client';
import { useRemote } from '../../hooks/useRemote';
import { C, card, faNum, right, row } from '../../zp/base';
import { Tile } from '../../zp/brand';
import { SubScreen } from '../../zp/Shell';
import { Async, Cta, EmptyState, SecHead, StatusPill, T } from '../../zp/ui';

type Tone = 'live' | 'ok' | 'bad' | 'idle';
type Workflow = { id: string; name: string; status?: string; trigger?: string; runCount?: number };
type Run = { id: string; workflowId?: string; workflowName?: string; status?: string; startedAt?: string };

const WF: Record<string, [string, Tone]> = { ACTIVE: ['فعال', 'ok'], ENABLED: ['فعال', 'ok'], PAUSED: ['متوقف', 'idle'], DISABLED: ['غیرفعال', 'idle'], ERROR: ['دارای خطا', 'bad'], DRAFT: ['پیش‌نویس', 'idle'] };
const RUN: Record<string, [string, Tone]> = { COMPLETED: ['موفق', 'ok'], SUCCESS: ['موفق', 'ok'], SUCCEEDED: ['موفق', 'ok'], RUNNING: ['در حال اجرا', 'live'], PENDING: ['در صف', 'live'], QUEUED: ['در صف', 'live'], FAILED: ['ناموفق', 'bad'], ERROR: ['ناموفق', 'bad'] };
const look = (m: Record<string, [string, Tone]>, s?: string): [string, Tone] => m[(s ?? '').toUpperCase()] ?? ['نامشخص', 'idle'];
const TRIGGER: Record<string, string> = { manual: 'دستی', schedule: 'زمان‌بندی‌شده', webhook: 'رویداد بیرونی', event: 'رویداد' };
const dt = new Intl.DateTimeFormat('fa-IR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

async function load() {
  const o = await appApi.overview();
  if (!o.workspaceId) return { workflows: [] as Workflow[], runs: [] as Run[] };
  const [w, r] = await Promise.all([automation.listWorkflows(o.workspaceId), automation.listRuns(o.workspaceId)]);
  return { workflows: w.items as Workflow[], runs: r.items as Run[] };
}

/** «فرآیندهای خودکار»: workflows and recent runs of the member's workspace (read-only; creation is done with the team). */
export function AutomationScreen() {
  const router = useRouter();
  const q = useRemote('load', load);
  return (
    <SubScreen title="فرآیندهای خودکار">
      <Async state={q} retry={q.retry}>
        {({ workflows, runs }) => {
          const active = workflows.filter(w => look(WF, w.status)[1] === 'ok').length;
          const ok = runs.filter(r => look(RUN, r.status)[1] === 'ok').length;
          if (workflows.length === 0 && runs.length === 0) {
            return <EmptyState icon="au" title="هنوز فرآیند خودکاری ندارید" text="تیم زُحل پی فرآیندهای خودکار کسب‌وکارتان را راه‌اندازی می‌کند. سفارش راه‌اندازی را از بخش خدمات ثبت کنید." action={{ label: 'سفارش راه‌اندازی', onPress: () => router.navigate({ pathname: '/services/[category]', params: { category: 'automation' } }) }} />;
          }
          return (
            <>
              <View style={{ flexDirection: row, gap: 8 }}>
                {[[faNum(active), 'فرآیند فعال'], [faNum(runs.length), 'کل اجراها'], [faNum(ok), 'اجرای موفق']].map(([v, l]) => (
                  <View key={l} style={[{ flex: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' }, card]}>
                    <T w="b" size={18} style={{ textAlign: 'center' }}>{v}</T>
                    <T size={10.5} color={C.muted} style={{ textAlign: 'center' }}>{l}</T>
                  </View>
                ))}
              </View>

              <SecHead title="فرآیندها" />
              {workflows.length === 0 ? <T size={12.5} color={C.muted}>فرآیندی تعریف نشده است.</T> : (
                <View style={{ gap: 8 }}>
                  {workflows.map(w => {
                    const [label, tone] = look(WF, w.status);
                    return (
                      <View key={w.id} style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 16, padding: 10 }, card, { shadowOpacity: 0.06 }]}>
                        <Tile icon="au" size={38} />
                        <View style={{ flex: 1, alignItems: right }}>
                          <T w="sb" size={13.5} numberOfLines={1}>{w.name}</T>
                          <T size={11} color={C.muted}>{TRIGGER[(w.trigger ?? 'manual').toLowerCase()] ?? 'خودکار'}{w.runCount != null ? ` | ${faNum(w.runCount)} اجرا` : ''}</T>
                        </View>
                        <StatusPill label={label} tone={tone} />
                      </View>
                    );
                  })}
                </View>
              )}

              <SecHead title="اجراهای اخیر" />
              {runs.length === 0 ? <T size={12.5} color={C.muted}>هنوز اجرایی ثبت نشده است.</T> : (
                <View style={[{ borderRadius: 18, paddingHorizontal: 12, paddingVertical: 4 }, card]}>
                  {runs.slice(0, 10).map((r, i) => {
                    const [label, tone] = look(RUN, r.status);
                    const d = r.startedAt ? new Date(r.startedAt) : null;
                    return (
                      <View key={r.id} style={[{ flexDirection: row, alignItems: 'center', gap: 10, paddingVertical: 10 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                        <View style={{ flex: 1, alignItems: right }}>
                          <T w="sb" size={13} numberOfLines={1}>{r.workflowName ?? 'فرآیند خودکار'}</T>
                          <T size={11} color={C.muted}>{d && !Number.isNaN(d.getTime()) ? dt.format(d) : 'زمان نامشخص'}</T>
                        </View>
                        <StatusPill label={label} tone={tone} />
                      </View>
                    );
                  })}
                </View>
              )}
              <Cta label="سفارش فرآیند خودکار جدید" full onPress={() => router.navigate({ pathname: '/services/[category]', params: { category: 'automation' } })} />
            </>
          );
        }}
      </Async>
    </SubScreen>
  );
}
