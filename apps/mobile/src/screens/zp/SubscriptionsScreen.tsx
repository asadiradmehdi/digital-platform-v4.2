import { useRef, useState } from 'react';
import { View } from 'react-native';
import { entitlementLabel } from '@digital-platform/api-contracts';
import { appApi, errorText, newIdempotencyKey } from '../../api/app';
import { plans as plansApi, subscriptions as subsApi } from '../../api/client';
import { formatToman } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { C, card, faNum, right, row, shadow } from '../../zp/base';
import { Enamel, Ornament, Tile } from '../../zp/brand';
import { Icon } from '../../zp/Icon';
import { SubScreen } from '../../zp/Shell';
import { Async, Cta, EmptyState, ErrorBox, SecHead, Sheet, StatusPill, T, useToast } from '../../zp/ui';

type Plan = Awaited<ReturnType<typeof plansApi.list>>['items'][number];

const PLAN_FA: Record<string, string> = { free: 'رایگان', basic: 'پایه', starter: 'پایه', pro: 'حرفه‌ای', business: 'کسب‌وکار', enterprise: 'سازمانی' };
const planName = (slug: string, name?: string) => {
  const k = slug.toLowerCase();
  const n = (name ?? '').trim().toLowerCase();
  return PLAN_FA[k] ?? PLAN_FA[n] ?? (name && /[؀-ۿ]/.test(name) ? name : 'پلن ویژه');
};
const STATUS: Record<string, { label: string; tone: 'ok' | 'live' | 'idle' | 'bad' }> = {
  ACTIVE: { label: 'فعال', tone: 'ok' }, TRIALING: { label: 'آزمایشی', tone: 'live' }, PAUSED: { label: 'متوقف', tone: 'idle' },
};
const dateFa = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
const interval = (i: string) => (i === 'YEARLY' || i === 'year' || i === 'yearly' ? 'سال' : 'ماه');

const featureLines = (p: Plan | undefined, keys?: string[]) => {
  if (!p) return [];
  return p.entitlements
    .filter(e => !keys || keys.includes(e.entitlement_key))
    .map(e => entitlementLabel(e.entitlement_key, e.value))
    .filter((x): x is string => !!x);
};

function Features({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      {lines.map(l => (
        <View key={l} style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.turquoiseSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="save" size={12} color={C.turquoiseInk} stroke={2.6} />
          </View>
          <T w="sb" size={12.5} style={{ flex: 1 }}>{l}</T>
        </View>
      ))}
    </View>
  );
}

function Body({ catalog, subs, workspaceId, notify, reload }: { catalog: Plan[]; subs: Awaited<ReturnType<typeof subsApi.list>>['items']; workspaceId: string | null; notify: (m: string) => void; reload: () => void }) {
  const active = subs.find(s => s.status === 'ACTIVE' || s.status === 'TRIALING' || s.status === 'PAUSED');
  const activePlan = active ? catalog.find(p => p.slug === active.plan) : undefined;
  const [pick, setPick] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idem = useRef<string | null>(null);

  const subscribe = async () => {
    if (!pick || !workspaceId) return;
    setBusy(true); setError(null);
    idem.current ??= newIdempotencyKey();
    try {
      await subsApi.create({ workspaceId, planId: pick.id }, idem.current);
      idem.current = null; setPick(null); notify('اشتراک شما فعال شد'); reload();
    } catch (e) { setError(errorText(e, 'فعال‌سازی انجام نشد. دوباره تلاش کنید.')); }
    finally { setBusy(false); }
  };

  const st = active ? STATUS[active.status] : null;
  return (
    <>
      {active ? (
        <Enamel radius={22} style={[{ padding: 16, gap: 12 }, shadow(12, 26, 0.3, '#0A1238')]}>
          <Ornament w={400} h={170} cx={70} cy={170} rot={10} color={C.gold1} alpha={0.55} />
          <View style={{ flexDirection: row, alignItems: 'center', gap: 12 }}>
            <Tile icon="pr" variant="gold" size={46} />
            <View style={{ flex: 1, alignItems: right }}>
              <T size={11} color="rgba(255,255,255,0.7)">اشتراک فعلی</T>
              <T w="b" size={19} color="#fff">پلن {planName(active.plan, activePlan?.name)}</T>
            </View>
            {st ? <StatusPill label={st.label} tone={st.tone} /> : null}
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.16)' }} />
          <View style={{ flexDirection: row, gap: 16 }}>
            <View style={{ flex: 1, alignItems: right }}>
              <T size={10.5} color="rgba(255,255,255,0.65)">هزینه</T>
              <T w="b" size={13.5} color={C.gold1}>{formatToman(active.priceMinor, active.currency)}</T>
            </View>
            <View style={{ flex: 1, alignItems: right }}>
              <T size={10.5} color="rgba(255,255,255,0.65)">تمدید بعدی</T>
              <T w="b" size={13.5} color="#fff">{Number.isNaN(new Date(active.renewalDate).getTime()) ? '—' : dateFa.format(new Date(active.renewalDate))}</T>
            </View>
          </View>
        </Enamel>
      ) : null}

      {active ? (
        <>
          <SecHead title="امکانات پلن شما" />
          <View style={[{ borderRadius: 18, padding: 14 }, card]}>
            {featureLines(activePlan, active.entitlements).length > 0
              ? <Features lines={featureLines(activePlan, active.entitlements)} />
              : <T size={12.5} color={C.muted}>جزئیات امکانات این پلن در دسترس نیست.</T>}
          </View>
          <T size={11.5} color={C.muted} style={{ lineHeight: 20 }}>تغییر یا لغو اشتراک از نسخه‌ی وب در بخش اشتراک و صورت‌حساب انجام می‌شود.</T>
        </>
      ) : null}

      <SecHead title={active ? 'پلن‌های زُحل پی' : 'یک پلن انتخاب کنید'} note={`${faNum(catalog.length)} پلن`} />
      {catalog.length === 0 ? (
        <EmptyState icon="pr" title="پلنی در دسترس نیست" text="در حال حاضر پلن فعالی برای نمایش وجود ندارد. بعداً دوباره سر بزنید." />
      ) : (
        <View style={{ gap: 10 }}>
          {catalog.map(p => {
            const mine = active?.plan === p.slug;
            return (
              <View key={p.id} style={[{ borderRadius: 18, padding: 14, gap: 12 }, card, mine && { borderColor: C.gold2, borderWidth: 1.5 }]}>
                <View style={{ flexDirection: row, alignItems: 'center', gap: 12 }}>
                  <Tile icon="pr" size={40} variant={mine ? 'gold' : 'enamel'} />
                  <View style={{ flex: 1, alignItems: right }}>
                    <T w="b" size={16}>{planName(p.slug, p.name)}</T>
                    <T size={12} color={C.muted}>{Number(p.price_minor) === 0 ? 'رایگان' : `${formatToman(p.price_minor, p.currency)} / ${interval(p.billing_interval)}`}</T>
                  </View>
                  {mine ? <StatusPill label="پلن شما" tone="ok" /> : null}
                </View>
                <Features lines={featureLines(p)} />
                {!active && Number(p.price_minor) > 0 ? <Cta label="فعال‌سازی" full disabled={!workspaceId} onPress={() => { setError(null); setPick(p); }} /> : null}
              </View>
            );
          })}
        </View>
      )}

      <Sheet open={!!pick} onClose={() => !busy && setPick(null)} title={pick ? `پلن ${planName(pick.slug, pick.name)}` : ''} subtitle="تأیید فعال‌سازی اشتراک" icon="pr" dismissable={!busy}>
        {pick ? (
          <>
            <T size={13} color={C.muted} style={{ lineHeight: 24 }}>مبلغ {formatToman(pick.price_minor, pick.currency)} در هر {interval(pick.billing_interval)} از موجودی کیف پول شما کسر می‌شود.</T>
            {error ? <ErrorBox text={error} /> : null}
            <Cta label="تأیید و فعال‌سازی" full busy={busy} onPress={() => void subscribe()} />
          </>
        ) : null}
      </Sheet>
    </>
  );
}

/** «پلن‌ها و اشتراک»: current subscription plus the public plan catalogue. All prices and limits come from the server. */
export function SubscriptionsScreen() {
  const toast = useToast();
  const catalog = useRemote(plansApi.list);
  const subs = useRemote(subsApi.list);
  const overview = useRemote(appApi.overview);
  const reload = () => { subs.reload(); overview.reload(); };
  const failed = [catalog, subs].find(q => q.status === 'error');
  const state = failed ? { status: 'error', data: null, error: failed.error } : catalog.status === 'success' && subs.status === 'success'
    ? { status: 'success', data: { catalog: catalog.data!.items, subs: subs.data!.items }, error: null } : { status: 'loading', data: null, error: null };
  return (
    <SubScreen title="پلن‌ها و اشتراک" overlay={toast.node}>
      <Async state={state} retry={() => { catalog.retry(); subs.retry(); }}>
        {d => <Body catalog={d.catalog} subs={d.subs} workspaceId={overview.data?.workspaceId ?? null} notify={toast.show} reload={reload} />}
      </Async>
    </SubScreen>
  );
}
