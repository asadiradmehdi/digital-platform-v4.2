import { useState } from 'react';
import { Switch, View } from 'react-native';
import { errorText } from '../../api/app';
import { me, notificationPrefs } from '../../api/client';
import { useRemote } from '../../hooks/useRemote';
import { C, card, row, right, shadow } from '../../zp/base';
import { Enamel, Fill, Ornament, Tile } from '../../zp/brand';
import { Icon, type IconName } from '../../zp/Icon';
import { SubScreen } from '../../zp/Shell';
import { Async, SecHead, StatusPill, T, useToast } from '../../zp/ui';

const CHANNELS = [
  { key: 'email', label: 'ایمیل' },
  { key: 'push', label: 'اعلان فوری' },
] as const;

const CATEGORIES: Array<{ key: string; label: string; desc: string; locked?: boolean }> = [
  { key: 'orders', label: 'سفارش‌ها', desc: 'تغییر وضعیت، تکمیل یا لغو سفارش' },
  { key: 'payments', label: 'پرداخت و کیف پول', desc: 'واریز، برداشت و تمدید اشتراک' },
  { key: 'security', label: 'امنیت', desc: 'ورود جدید و رویدادهای حساس', locked: true },
  { key: 'ai', label: 'هوش مصنوعی', desc: 'اتمام اعتبار و خطاهای سرویس' },
  { key: 'automation', label: 'فرآیند خودکار', desc: 'فرآیند تکمیل‌شده یا متوقف‌شده' },
  { key: 'updates', label: 'اخبار و به‌روزرسانی', desc: 'قابلیت‌های جدید و تغییرات مهم' },
];

const defaultOn = (channel: string, category: string) => category === 'security' || (channel === 'email' && category !== 'updates');

function InfoRow({ icon, label, value, verified }: { icon: IconName; label: string; value: string | null; verified?: boolean }) {
  return (
    <View style={{ flexDirection: row, alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Tile icon={icon} size={36} />
      <View style={{ flex: 1, alignItems: right }}>
        <T size={11} color={C.muted}>{label}</T>
        <T w="sb" size={14} numberOfLines={1}>{value ?? 'ثبت نشده'}</T>
      </View>
      {value ? <StatusPill label={verified ? 'تأییدشده' : 'تأییدنشده'} tone={verified ? 'ok' : 'idle'} /> : null}
    </View>
  );
}

function Profile() {
  const q = useRemote(me.get);
  return (
    <Async state={q} retry={q.retry}>
      {({ user }) => {
        const name = user.displayName?.trim() || 'کاربر زُحل پی';
        return (
          <>
            <Enamel radius={22} style={[{ padding: 16, flexDirection: row, alignItems: 'center', gap: 14 }, shadow(12, 26, 0.3, '#0A1238')]}>
              <Ornament w={400} h={110} cx={70} cy={120} rot={10} color={C.gold1} alpha={0.55} />
              <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: C.gold2, padding: 3, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{ flex: 1, borderRadius: 30, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  <Fill kind="enamel" />
                  <T w="b" size={22} color={C.gold1} style={{ textAlign: 'center' }}>{name.slice(0, 1)}</T>
                </View>
              </View>
              <View style={{ flex: 1, alignItems: right }}>
                <T w="b" size={17} color="#fff" numberOfLines={1}>{name}</T>
                <T size={11.5} color="rgba(255,255,255,0.72)">حساب کاربری زُحل پی</T>
              </View>
            </Enamel>
            <View style={[{ borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4 }, card]}>
              <InfoRow icon="user" label="نام" value={user.displayName?.trim() || null} />
              <View style={{ height: 1, backgroundColor: C.line }} />
              <InfoRow icon="phone" label="شماره موبایل" value={user.phone} verified={user.phoneVerified} />
              <View style={{ height: 1, backgroundColor: C.line }} />
              <InfoRow icon="doc" label="ایمیل" value={user.email} verified={user.emailVerified} />
            </View>
            <T size={11.5} color={C.muted} style={{ lineHeight: 20 }}>تغییر نام، شماره و ایمیل نیازمند تأیید با کد پیامکی است و از نسخه‌ی وب در بخش حساب کاربری انجام می‌شود.</T>
          </>
        );
      }}
    </Async>
  );
}

function Notifications({ notify }: { notify: (m: string) => void }) {
  const q = useRemote(notificationPrefs.get);
  // Switches the member changed on this screen; everything else comes from the server.
  const [local, setLocal] = useState<Record<string, boolean>>({});

  return (
    <Async state={q} retry={q.retry}>
      {d => {
        const lockedSet = new Set(d.locked);
        const saved = new Map(d.preferences.map(p => [`${p.channel}:${p.category}`, p.enabled]));
        const isOn = (ch: string, cat: string) => local[`${ch}:${cat}`] ?? saved.get(`${ch}:${cat}`) ?? defaultOn(ch, cat);
        const toggle = async (ch: string, cat: string, value: boolean) => {
          const k = `${ch}:${cat}`;
          const before = isOn(ch, cat);
          setLocal(s => ({ ...s, [k]: value }));
          try { await notificationPrefs.save([{ channel: ch, category: cat, enabled: value }]); notify('ذخیره شد'); }
          catch (e) { setLocal(s => ({ ...s, [k]: before })); notify(errorText(e, 'ذخیره انجام نشد. دوباره تلاش کنید.')); }
        };
        return (
          <View style={{ gap: 8 }}>
            {CATEGORIES.map(c => (
              <View key={c.key} style={[{ borderRadius: 16, padding: 12, gap: 8 }, card, { shadowOpacity: 0.06 }]}>
                <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1, alignItems: right }}>
                    <T w="sb" size={14}>{c.label}</T>
                    <T size={11} color={C.muted}>{c.desc}</T>
                  </View>
                  {c.locked ? <StatusPill label="همیشه فعال" tone="ok" /> : null}
                </View>
                {!c.locked ? (
                  <View style={{ flexDirection: row, gap: 8 }}>
                    {CHANNELS.map(ch => {
                      const fixed = lockedSet.has(`${ch.key}:${c.key}`);
                      return (
                        <View key={ch.key} style={{ flex: 1, flexDirection: row, alignItems: 'center', gap: 8, backgroundColor: C.surface2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <T w="sb" size={12} style={{ flex: 1 }}>{ch.label}</T>
                          <Switch
                            accessibilityLabel={`${c.label}، ${ch.label}`} value={isOn(ch.key, c.key)} disabled={fixed}
                            onValueChange={v => void toggle(ch.key, c.key, v)}
                            trackColor={{ false: C.line, true: C.gold2 }} thumbColor="#fff"
                          />
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ))}
            <View style={{ flexDirection: row, alignItems: 'center', gap: 8, paddingTop: 2 }}>
              <Icon name="info" size={16} color={C.muted} />
              <T size={11} color={C.muted} style={{ flex: 1, lineHeight: 19 }}>کد ورود و رسید پرداخت همیشه با پیامک ارسال می‌شود و قابل خاموش‌کردن نیست.</T>
            </View>
          </View>
        );
      }}
    </Async>
  );
}

/** «اطلاعات حساب و اعلان‌ها»: profile facts from /me and the notification switches of the account. */
export function SettingsScreen() {
  const toast = useToast();
  return (
    <SubScreen title="اطلاعات حساب و اعلان‌ها" overlay={toast.node}>
      <Profile />
      <SecHead title="اعلان‌ها" note="هر دسته را جداگانه تنظیم کنید" />
      <Notifications notify={toast.show} />
    </SubScreen>
  );
}
