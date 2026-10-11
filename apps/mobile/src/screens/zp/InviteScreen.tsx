import { useState } from 'react';
import { Share, View } from 'react-native';
import { appApi, errorText } from '../../api/app';
import { formatTomanNumber } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { C, card, faNum, right, row, shadow } from '../../zp/base';
import { Enamel, Ornament, Tile } from '../../zp/brand';
import { SubScreen } from '../../zp/Shell';
import { Async, Cta, ErrorBox, Progress, SecHead, StatusPill, T } from '../../zp/ui';

const pct = (n: number) => `${faNum(n)}٪`;

/** «دعوت از دوستان»: the member's code, current share, share sheet and friends. Mirrors web /invite. */
export function InviteScreen() {
  const data = useRemote('appApi.referral', appApi.referral);
  const [error, setError] = useState<string | null>(null);

  return (
    <SubScreen title="دعوت از دوستان">
      <Async state={data} retry={data.retry}>
        {d => {
          const message = d.welcomePercent > 0
            ? `با لینک من توی زُحل پی عضو شو و با اولین خرید ${pct(d.welcomePercent)} اعتبار هدیه بگیر:\n${d.link}`
            : `با لینک من توی زُحل پی عضو شو:\n${d.link}`;
          const share = async () => {
            setError(null);
            try { await Share.share({ message }); }
            catch (e) { setError(errorText(e, 'اشتراک‌گذاری انجام نشد.')); }
          };
          const progress = d.nextSharePercent && d.friendsToNext != null ? d.active / (d.active + d.friendsToNext) : 1;
          return (
            <>
              <Enamel radius={26} style={[{ padding: 18, gap: 8 }, shadow(14, 28, 0.3, '#0A1238')]}>
                <Ornament w={400} h={220} cx={40} cy={230} rot={14} color={C.gold1} alpha={0.45} girih={false} />
                <View style={{ flexDirection: row, alignItems: 'center', gap: 10 }}>
                  <Tile icon="gift" variant="gold" size={40} />
                  <T w="b" size={11.5} color={C.gold1}>دعوت از دوستان</T>
                </View>
                <T w="dx" size={20} color="#fff" style={{ lineHeight: 34 }}>
                  از هر خرید دوستانت <T w="b" size={28} color={C.gold1}>{pct(d.sharePercent)}</T> سهم توست
                </T>
                <T size={12} color="rgba(255,255,255,0.82)" style={{ lineHeight: 22 }}>
                  دوستانت رو به زُحل پی بیار؛ هر بار که خرید کنن یا کیف پولشون رو شارژ کنن، سهمت مستقیم به کیف پولت میاد.
                </T>
                <View style={{ flexDirection: row, alignItems: 'center', gap: 10 }}>
                  {d.nextSharePercent ? (
                    <>
                      <View style={{ width: 110 }}><Progress value={Math.max(0.04, progress)} track="rgba(255,255,255,0.16)" /></View>
                      <T size={11} color="rgba(255,255,255,0.86)">{faNum(d.friendsToNext ?? 0)} دوست فعال دیگه تا سهم <T w="b" size={11} color={C.gold1}>{pct(d.nextSharePercent)}</T></T>
                    </>
                  ) : <T size={11} color="rgba(255,255,255,0.86)">شما در بالاترین سطح دعوت هستید.</T>}
                </View>
              </Enamel>

              <View style={[{ borderRadius: 20, padding: 12, gap: 10 }, card]}>
                <View style={{ borderRadius: 14, backgroundColor: C.surface2, paddingVertical: 8, paddingHorizontal: 12, alignItems: right }}>
                  <T size={10.5} color={C.muted}>کد دعوت شما</T>
                  <T w="b" size={22} color={C.accentStrong} style={{ letterSpacing: 6, writingDirection: 'ltr' }} selectable>{d.code}</T>
                </View>
                <Cta full icon="share" label="ارسال دعوت برای دوستان" onPress={share} />
                {error ? <ErrorBox text={error} /> : null}
              </View>

              <View style={{ flexDirection: row, gap: 8 }}>
                {[[faNum(d.invited), 'دعوت‌شده'], [faNum(d.active), 'دوست فعال'], [formatTomanNumber(d.earnedToman), 'درآمد شما (تومان)']].map(([v, l]) => (
                  <View key={l} style={[{ flex: 1, borderRadius: 16, paddingVertical: 9, paddingHorizontal: 6, alignItems: 'center' }, card]}>
                    <T w="b" size={16} style={{ textAlign: 'center' }}>{v}</T>
                    <T size={10} color={C.muted} style={{ textAlign: 'center' }}>{l}</T>
                  </View>
                ))}
              </View>
              {d.pendingToman > 0 ? (
                <View style={{ flexDirection: row, alignItems: 'center', gap: 10 }}>
                  <Tile icon="clock" size={30} />
                  <T w="sb" size={12} color={C.goldText}>{formatTomanNumber(d.pendingToman)} تومان در راه کیف پول شماست</T>
                </View>
              ) : null}

              <View style={{ flexDirection: row, gap: 8 }}>
                {([
                  ['share', 'لینک یا کد رو برای دوستت بفرست'],
                  ['gift', `دوستت عضو می‌شه و با اولین خرید ${pct(d.welcomePercent)} هدیه می‌گیره`],
                  ['wallet', 'از هر خرید یا شارژش، سهم تو به کیف پولت اضافه می‌شه'],
                ] as const).map(([icon, text], i) => (
                  <View key={icon} style={[{ flex: 1, borderRadius: 16, padding: 8, alignItems: 'center', gap: 6 }, card]}>
                    <T w="b" size={10} color={C.gold3} style={{ alignSelf: 'stretch' }}>{faNum(i + 1)}</T>
                    <Tile icon={icon} size={34} />
                    <T size={10.5} color={C.muted} style={{ textAlign: 'center', lineHeight: 18 }}>{text}</T>
                  </View>
                ))}
              </View>

              <SecHead title="دوستان شما" note={d.invited ? `${faNum(d.invited)} نفر` : undefined} />
              {d.friends.length ? (
                <View style={{ gap: 8 }}>
                  {d.friends.map((f, i) => (
                    <View key={i} style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10 }, card]}>
                      <Tile icon="user" size={36} />
                      <T w="sb" size={13.5} style={{ flex: 1 }}>{f.name}</T>
                      <StatusPill label={f.active ? 'فعال' : 'منتظر اولین خرید'} tone={f.active ? 'ok' : 'live'} />
                    </View>
                  ))}
                </View>
              ) : (
                <T size={12.5} color={C.muted} style={{ lineHeight: 22 }}>هنوز کسی با لینک شما عضو نشده. اولین دعوت رو همین حالا بفرستید.</T>
              )}
            </>
          );
        }}
      </Async>
    </SubScreen>
  );
}
