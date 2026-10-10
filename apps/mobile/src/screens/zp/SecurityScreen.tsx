import { useState } from 'react';
import { View } from 'react-native';
import { errorText } from '../../api/app';
import { account, auditEvents, me, sessions } from '../../api/client';
import { PasswordSheet, TwoFactorSheet } from './AccountSheets';
import { useRemote } from '../../hooks/useRemote';
import { C, card, right, row, shadow } from '../../zp/base';
import { Enamel, Ornament, Tile } from '../../zp/brand';
import type { IconName } from '../../zp/Icon';
import { SubScreen } from '../../zp/Shell';
import { Async, Cta, EmptyState, ErrorBox, Press, SecHead, StatusPill, T, useToast } from '../../zp/ui';
import { fwd } from '../../zp/base';
import { Icon } from '../../zp/Icon';

const AUDIT: Record<string, { label: string; icon: IconName }> = {
  LOGIN: { label: 'ورود به حساب', icon: 'user' },
  LOGOUT: { label: 'خروج از حساب', icon: 'out' },
  SESSION_REVOKED: { label: 'خروج یک دستگاه', icon: 'out' },
  SESSIONS_REVOKED: { label: 'خروج از سایر دستگاه‌ها', icon: 'out' },
  PASSWORD_CHANGED: { label: 'تغییر رمز عبور', icon: 'shield' },
  PHONE_CHANGED: { label: 'تغییر شماره موبایل', icon: 'phone' },
  EMAIL_CHANGED: { label: 'تغییر ایمیل', icon: 'doc' },
  IDENTITY_LINKED: { label: 'اتصال حساب ورود', icon: 'user' },
  STEP_UP_VERIFIED: { label: 'تأیید هویت برای کار حساس', icon: 'shieldS' },
  PASSKEY_REGISTERED: { label: 'افزودن ورود با اثر انگشت یا چهره', icon: 'shieldS' },
  PASSKEY_REVOKED: { label: 'حذف ورود با اثر انگشت یا چهره', icon: 'shield' },
  PASSKEY_AUTHENTICATED: { label: 'ورود با اثر انگشت یا چهره', icon: 'shieldS' },
  TRUSTED_DEVICE_REGISTERED: { label: 'افزودن دستگاه مطمئن', icon: 'shieldS' },
  TRUSTED_DEVICE_REVOKED: { label: 'حذف دستگاه مطمئن', icon: 'shield' },
  ALL_TRUSTED_DEVICES_REVOKED: { label: 'حذف همه‌ی دستگاه‌های مطمئن', icon: 'shield' },
  'ORDER.CREATED': { label: 'ثبت سفارش', icon: 'tOrders' },
  'ORDER.CANCELLED': { label: 'لغو سفارش', icon: 'tOrders' },
  'PAYMENT.PAID': { label: 'پرداخت موفق', icon: 'wallet' },
};

const dt = new Intl.DateTimeFormat('fa-IR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : dt.format(d); };

function Devices({ notify }: { notify: (m: string) => void }) {
  const q = useRemote(sessions.list);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key); setError(null);
    try { await fn(); notify(done); q.reload(); }
    catch (e) { setError(errorText(e, 'انجام نشد. دوباره تلاش کنید.')); }
    finally { setBusy(null); }
  };

  return (
    <Async state={q} retry={q.retry}>
      {d => {
        const others = d.items.filter(s => !s.current).length;
        if (d.items.length === 0) return <EmptyState icon="shield" title="دستگاهی ثبت نشده" text="هنوز دستگاهی با این حساب وارد نشده است." />;
        return (
          <View style={{ gap: 8 }}>
            {d.items.map(s => (
              <View key={s.id} style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 16, padding: 10 }, card, { shadowOpacity: 0.06 }]}>
                <Tile icon={s.clientType === 'mobile' ? 'phone' : 'grid'} size={38} variant={s.current ? 'gold' : 'enamel'} />
                <View style={{ flex: 1, alignItems: right, gap: 1 }}>
                  <T w="sb" size={13.5} numberOfLines={1}>{s.deviceName || (s.clientType === 'mobile' ? 'برنامه‌ی موبایل' : 'مرورگر')}</T>
                  <T size={11} color={C.muted}>{s.clientType === 'mobile' ? 'برنامه‌ی موبایل' : 'مرورگر'}{when(s.lastSeenAt ?? s.createdAt) ? ` · ${when(s.lastSeenAt ?? s.createdAt)}` : ''}</T>
                </View>
                {s.current ? <StatusPill label="این دستگاه" tone="ok" /> : (
                  <Press accessibilityRole="button" accessibilityLabel={`خروج ${s.deviceName}`} disabled={busy !== null} onPress={() => void run(s.id, () => sessions.revoke(s.id), 'دستگاه خارج شد')}
                    style={{ backgroundColor: C.dangerSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, opacity: busy === s.id ? 0.5 : 1 }}>
                    <T w="b" size={12} color={C.danger}>{busy === s.id ? 'در حال خروج…' : 'خروج'}</T>
                  </Press>
                )}
              </View>
            ))}
            {others > 1 ? <Cta label="خروج از همه‌ی دستگاه‌های دیگر" busy={busy === 'all'} disabled={busy !== null} onPress={() => void run('all', sessions.revokeOthers, 'از سایر دستگاه‌ها خارج شدید')} /> : null}
            {error ? <ErrorBox text={error} /> : null}
          </View>
        );
      }}
    </Async>
  );
}

function Activity() {
  const q = useRemote(auditEvents.list);
  return (
    <Async state={q} retry={q.retry}>
      {d => d.items.length === 0 ? (
        <EmptyState icon="clock" title="فعالیتی ثبت نشده" text="ورودها و تغییرات مهم حساب شما همین‌جا فهرست می‌شود." />
      ) : (
        <View style={[{ borderRadius: 18, paddingHorizontal: 12, paddingVertical: 4 }, card]}>
          {d.items.map((ev, i) => {
            const m = AUDIT[ev.action.toUpperCase()] ?? { label: 'فعالیت حساب', icon: 'info' as IconName };
            return (
              <View key={ev.id} style={[{ flexDirection: row, alignItems: 'center', gap: 12, paddingVertical: 10 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                <Tile icon={m.icon} size={34} variant="ghost" />
                <T w="sb" size={13} style={{ flex: 1 }}>{m.label}</T>
                <T size={11} color={C.muted}>{when(ev.createdAt)}</T>
              </View>
            );
          })}
        </View>
      )}
    </Async>
  );
}

function ActionRow({ icon, label, note, status, onPress }: { icon: IconName; label: string; note: string; status?: { label: string; tone: 'ok' | 'idle' }; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 16, padding: 10 }, card, { shadowOpacity: 0.06 }]}>
      <Tile icon={icon} size={36} />
      <View style={{ flex: 1, alignItems: right }}>
        <T w="sb" size={13.5}>{label}</T>
        <T size={11} color={C.muted}>{note}</T>
      </View>
      {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
      <Icon name={fwd} size={16} color={C.muted} stroke={2.2} />
    </Press>
  );
}

/** Password and two-step sign-in, fully inside the app. */
function SignInSettings({ notify }: { notify: (m: string) => void }) {
  const profile = useRemote(me.get);
  const mfa = useRemote(account.mfaStatus);
  const [pw, setPw] = useState(false);
  const [tf, setTf] = useState(false);
  const u = profile.data?.user;
  return (
    <View style={{ gap: 8 }}>
      <ActionRow icon="shield" label={u && !u.hasPassword ? 'ساخت رمز عبور' : 'تغییر رمز عبور'} note="رمز تازه با کد پیامکی تأیید می‌شود" onPress={() => setPw(true)} />
      <ActionRow icon="shieldS" label="ورود دومرحله‌ای" note="کد برنامه‌ی تأیید هویت، علاوه بر رمز"
        status={mfa.data ? (mfa.data.mfaEnabled ? { label: 'فعال', tone: 'ok' } : { label: 'غیرفعال', tone: 'idle' }) : undefined} onPress={() => setTf(true)} />
      <PasswordSheet open={pw} onClose={() => setPw(false)} done={notify} hasPassword={u?.hasPassword ?? true} phoneVerified={u?.phoneVerified ?? false} />
      <TwoFactorSheet open={tf} onClose={() => { setTf(false); mfa.reload(); }} done={m => { notify(m); mfa.reload(); }} enabled={mfa.data?.mfaEnabled ?? false} accountName={u?.email ?? u?.phone ?? ''} />
    </View>
  );
}

/** «امنیت و ورود»: signed-in devices (revocable), recent account activity, and pointers to web-only settings. */
export function SecurityScreen() {
  const toast = useToast();
  return (
    <SubScreen title="امنیت و ورود" overlay={toast.node}>
      <Enamel radius={22} style={[{ padding: 16, flexDirection: row, alignItems: 'center', gap: 12 }, shadow(12, 26, 0.3, '#0A1238')]}>
        <Ornament w={400} h={100} cx={60} cy={110} rot={10} color={C.gold1} alpha={0.55} />
        <Tile icon="shieldS" variant="gold" size={46} />
        <View style={{ flex: 1, alignItems: right }}>
          <T w="b" size={16} color="#fff">امنیت حسابتان در دست خودتان است</T>
          <T size={11.5} color="rgba(255,255,255,0.74)" style={{ lineHeight: 20 }}>دستگاه‌های واردشده و فعالیت‌های اخیر را همین‌جا ببینید و مدیریت کنید.</T>
        </View>
      </Enamel>

      <SecHead title="دستگاه‌های واردشده" />
      <Devices notify={toast.show} />

      <SecHead title="فعالیت‌های اخیر" />
      <Activity />

      <SecHead title="رمز و ورود" />
      <SignInSettings notify={toast.show} />
    </SubScreen>
  );
}
