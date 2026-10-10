import { useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { appApi } from '../../api/app';
import { useAuth } from '../../auth/AuthProvider';
import { formatQuantityWords } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { C, F, card, faNum, fwd, right, row, shadow } from '../../zp/base';
import { Enamel, Fill, Ornament, Tile, type TileVariant } from '../../zp/brand';
import { Icon, type IconName } from '../../zp/Icon';
import { AppScreen } from '../../zp/Shell';
import { Async, ErrorBox, IconBtn, Press, Progress, T } from '../../zp/ui';

function MenuRow({ icon, label, note, tag, onPress, variant, busy }: { icon: IconName; label: string; note?: string; tag?: boolean; onPress: () => void; variant?: TileVariant; busy?: boolean }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={note ? `${label}، ${note}` : label} accessibilityState={{ busy }} disabled={busy} onPress={onPress}
      style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10 }, card, { shadowOpacity: 0.06 }]}>
      <Tile icon={icon} size={36} variant={variant} />
      <T w="sb" size={14} style={{ flex: 1 }}>{label}</T>
      {note ? (
        <View style={tag ? { backgroundColor: C.turquoiseSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 } : undefined}>
          <T w={tag ? 'b' : 'm'} size={10.5} color={tag ? C.turquoiseInk : C.muted}>{note}</T>
        </View>
      ) : null}
      <Icon name={fwd} size={16} color={C.muted} stroke={2.4} />
    </Press>
  );
}

export function AccountScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const overview = useRemote(appApi.overview);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = async () => {
    setLeaving(true); setError(null);
    try { await signOut(); router.replace('/login'); }
    catch { setError('خروج انجام نشد. دوباره تلاش کنید.'); }
    finally { setLeaving(false); }
  };

  return (
    <AppScreen>
      <Async state={overview} retry={overview.retry}>
        {o => {
          const t = o.tier;
          const rows: Array<{ icon: IconName; label: string; note: string; tag?: boolean; href: Href }> = [
            { icon: 'gift', label: 'دعوت از دوستان', note: 'از هر خرید دوستانتان سهم بگیرید', href: '/invite' },
            { icon: 'doc', label: 'فاکتورها', note: 'فاکتور خرید و رسید شارژ', href: '/invoices' },
            { icon: 'userCard', label: 'اطلاعات حساب', note: 'نام، شماره و ایمیل', href: '/settings' },
            { icon: 'shield', label: 'امنیت و ورود', note: o.mfa ? 'ورود دومرحله‌ای فعال' : 'فعال‌سازی ورود دومرحله‌ای', tag: o.mfa, href: '/security' },
            { icon: 'bell', label: 'اعلان‌ها', note: 'وضعیت سفارش و پیشنهادها', href: '/settings' },
            { icon: 'chat', label: 'پشتیبانی', note: 'تیکت و تماس تلفنی', href: '/support' },
            { icon: 'cert', label: 'مجوزها و نمادها', note: 'اینماد و ساماندهی', href: '/licenses' },
          ];
          return (
            <>
              <View style={{ flexDirection: row, alignItems: 'center', gap: 14 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: C.gold2, padding: 3, backgroundColor: C.bg }}>
                  <View style={{ flex: 1, borderRadius: 30, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    <Fill kind="enamel" />
                    <T w="b" size={22} color={C.gold1} style={{ textAlign: 'center', fontFamily: F.b }}>{o.viewer.displayName.slice(0, 1)}</T>
                  </View>
                </View>
                <View style={{ flex: 1, alignItems: right, gap: 2 }}>
                  <T w="b" size={17.5}>{o.viewer.displayName}</T>
                  {o.viewer.contact ? <T size={12} color={C.muted} numberOfLines={1}>{o.viewer.contact}</T> : null}
                </View>
                <IconBtn icon="edit" label="ویرایش اطلاعات" size={38} onPress={() => router.navigate('/settings')} />
              </View>

              <Enamel kind="goldLight" radius={22} style={[{ paddingVertical: 14, paddingHorizontal: 16, gap: 10 }, shadow(14, 26, 0.35, '#7a5218')]}>
                <Ornament w={400} h={130} cx={60} cy={140} rot={12} color={C.gold4} alpha={0.5} />
                <View style={{ flexDirection: row, alignItems: 'center', gap: 10 }}>
                  <Tile icon="shamseh" size={42} />
                  <View style={{ flex: 1, alignItems: right }}>
                    <T w="dx" size={17} color={C.accentStrong} style={{ lineHeight: 26 }}>سطح {t.name}</T>
                    <T w="sb" size={11} color={C.gold4}>بر اساس مجموع خریدهای پرداخت‌شده شما</T>
                  </View>
                  <View style={{ backgroundColor: C.accentStrong, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <T w="b" size={10.5} color={C.gold1}>سطح {faNum(t.level)} از {faNum(t.levels)}</T>
                  </View>
                </View>
                <View style={{ flexDirection: row, alignItems: 'center', gap: 10 }}>
                  <Progress value={t.progress} track="rgba(122,82,24,0.18)" fill="enamel" />
                  <T w="sb" size={10.5} color={C.gold4}>{t.next ? `${formatQuantityWords(t.remainingToman)} تومان خرید دیگر تا سطح ${t.next}` : 'بالاترین سطح'}</T>
                </View>
              </Enamel>

              <View style={{ flexDirection: row, gap: 8 }}>
                {[
                  [faNum(o.stats.totalOrders), 'کل سفارش‌ها'],
                  [faNum(o.stats.activeOrders), 'در حال انجام'],
                  [o.stats.spentToman ? formatQuantityWords(o.stats.spentToman) : '۰', 'خرید کل (تومان)'],
                ].map(([v, l]) => (
                  <View key={l} style={[{ flex: 1, borderRadius: 16, paddingVertical: 9, paddingHorizontal: 6, alignItems: 'center' }, card]}>
                    <T w="b" size={16.5} style={{ textAlign: 'center' }}>{v}</T>
                    <T size={10} color={C.muted} style={{ textAlign: 'center' }}>{l}</T>
                  </View>
                ))}
              </View>

              <View style={{ gap: 8 }}>
                {rows.map(r => <MenuRow key={r.label} icon={r.icon} label={r.label} note={r.note} tag={r.tag} onPress={() => router.navigate(r.href)} />)}
                <MenuRow icon="out" label={leaving ? 'در حال خروج…' : 'خروج از حساب'} variant="danger" busy={leaving} onPress={logout} />
                {error ? <ErrorBox text={error} /> : null}
              </View>
            </>
          );
        }}
      </Async>
    </AppScreen>
  );
}
