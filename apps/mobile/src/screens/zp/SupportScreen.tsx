// پشتیبانی و تیکت: contact card (tap a number to open the dialer), category shortcuts and the ticket list.
// Mirrors app/support/page.tsx; all wording and dates come from /api/v1/app/support.
import { Linking, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supportApi, type AppSupport, type AppSupportPhone, type AppTicketCard } from '../../api/app';
import { useRemote } from '../../hooks/useRemote';
import { C, RTL, card, right, row } from '../../zp/base';
import { Enamel, Ornament, Tile } from '../../zp/brand';
import { Icon } from '../../zp/Icon';
import { SubScreen } from '../../zp/Shell';
import { Async, Cta, EmptyState, Press, SecHead, StatusPill, T, useToast } from '../../zp/ui';

export function SupportContactCard({ phones, hours, onNewTicket, onDialError }: {
  phones: AppSupportPhone[]; hours: string; onNewTicket: () => void; onDialError: () => void;
}) {
  const dial = (p: AppSupportPhone) => { Linking.openURL(`tel:${p.tel}`).catch(onDialError); };
  return (
    <Enamel radius={24} style={{ padding: 14, gap: 12 }}>
      <Ornament w={400} h={phones.length ? 260 : 200} cx={360} cy={30} rot={-14} color={C.gold1} alpha={0.5} />
      <View style={{ flexDirection: row, alignItems: 'center', gap: 12 }}>
        <Tile icon="chat" variant="gold" size={46} />
        <View style={{ flex: 1, alignItems: right, gap: 2 }}>
          <T w="dx" size={17} color="#fff" accessibilityRole="header" style={{ lineHeight: 28 }}>پشتیبانی زُحل پی</T>
          <View style={{ flexDirection: row, alignItems: 'center', gap: 5 }}>
            <Icon name="clock" size={14} color={C.gold1} />
            <T size={11.5} color="rgba(255,255,255,0.78)">{hours}</T>
          </View>
        </View>
      </View>
      {phones.length ? (
        <View style={{ gap: 8 }}>
          {phones.map(p => (
            <Press key={p.tel} accessibilityRole="link" accessibilityLabel={`تماس با ${p.label}: ${p.display}`} accessibilityHint="شماره‌گیر تلفن باز می‌شود"
              onPress={() => dial(p)}
              style={{ flexDirection: row, alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(242,211,144,0.28)' }}>
              <Tile icon="phone" variant="gold" size={40} />
              <View style={{ flex: 1, alignItems: right }}>
                <T w="sb" size={11} color="rgba(255,255,255,0.72)">{p.label}</T>
                <T w="b" size={18.5} color="#fff" style={{ writingDirection: 'ltr' }}>{p.display}</T>
              </View>
              <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: C.gold1 }}>
                <T w="b" size={11.5} color={C.onGold}>تماس</T>
              </View>
            </Press>
          ))}
        </View>
      ) : (
        <>
          <T size={12.5} color="rgba(255,255,255,0.82)" style={{ lineHeight: 24 }}>
            درخواست‌تان را با تیکت ثبت کنید؛ کارشناسان ما در ساعات کاری پاسخ می‌دهند و همه‌ی گفتگو همین‌جا برای پیگیری می‌ماند.
          </T>
          <Cta big label="ثبت تیکت جدید" onPress={onNewTicket} />
        </>
      )}
    </Enamel>
  );
}

function TicketRow({ t, onPress }: { t: AppTicketCard; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={`${t.subject}، ${t.status.label}${t.unread ? '، پاسخ تازه' : ''}`} onPress={onPress}
      style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 20, paddingVertical: 11, paddingHorizontal: 12, opacity: t.closed ? 0.78 : 1 }, card]}>
      <Tile icon={t.icon} size={42} />
      <View style={{ flex: 1, alignItems: right, gap: 1 }}>
        <T w="b" size={14} numberOfLines={1}>{t.subject}</T>
        <T size={11} color={C.muted} numberOfLines={1}>{t.code} · {t.preview}</T>
      </View>
      <View style={{ alignItems: RTL ? 'flex-end' : 'flex-start', gap: 6 }}>
        <StatusPill label={t.status.label} tone={t.status.tone} />
        <View style={{ flexDirection: row, alignItems: 'center', gap: 5 }}>
          {t.unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.vermilion }} /> : null}
          <T size={10.5} color={C.muted}>{t.when}</T>
        </View>
      </View>
    </Press>
  );
}

function Body({ d, notify }: { d: AppSupport; notify: (m: string) => void }) {
  const router = useRouter();
  const newTicket = (category?: string) => router.push(category ? { pathname: '/support/new', params: { category } } : '/support/new');
  return (
    <>
      <SupportContactCard phones={d.phones} hours={d.hours} onNewTicket={() => newTicket()} onDialError={() => notify('شماره‌گیر تلفن باز نشد')} />

      <SecHead title="درخواست درباره‌ی…" note="یک موضوع را انتخاب کنید" />
      <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8 }}>
        {d.categories.map(c => (
          <Press key={c.key} accessibilityRole="button" accessibilityLabel={`تیکت درباره‌ی ${c.label}`} onPress={() => newTicket(c.key)}
            style={[{ width: '31.5%', alignItems: 'center', gap: 6, borderRadius: 18, paddingTop: 10, paddingBottom: 9, paddingHorizontal: 4 }, card]}>
            <Tile icon={c.icon} size={38} />
            <T w="b" size={11.8} color={C.ink2} style={{ textAlign: 'center', lineHeight: 17 }}>{c.label}</T>
          </Press>
        ))}
      </View>

      {d.tickets.length ? (
        <>
          <SecHead title="تیکت‌های من" link="+ تیکت جدید" onLink={() => newTicket()} />
          <View style={{ gap: 10 }}>
            {d.tickets.map(t => <TicketRow key={t.id} t={t} onPress={() => router.push({ pathname: '/support/[id]', params: { id: t.id } })} />)}
          </View>
        </>
      ) : (
        <EmptyState icon="cmt" title="هنوز تیکتی ندارید"
          text={d.workspaceId ? 'هر سؤال یا مشکلی دارید، تیکت بزنید. پاسخ کارشناس همین‌جا نمایش داده می‌شود.' : 'برای حساب شما فضای کاری فعالی پیدا نشد؛ لطفاً با پشتیبانی تماس بگیرید.'}
          action={d.workspaceId ? { label: 'ثبت تیکت جدید', onPress: () => newTicket() } : undefined} />
      )}
    </>
  );
}

export function SupportScreen() {
  const support = useRemote(supportApi.overview);
  const toast = useToast();
  return (
    <SubScreen title="پشتیبانی و تیکت" overlay={toast.node}>
      <Async state={support} retry={support.retry}>{d => <Body d={d} notify={toast.show} />}</Async>
    </SubScreen>
  );
}
