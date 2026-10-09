// گفتگوی پشتیبانی: ticket header, customer/staff bubbles and the reply composer. Mirrors app/support/[id].
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BODY_MAX, BODY_MIN, errorText, supportApi, type AppTicketDetail } from '../../api/app';
import { useRemote } from '../../hooks/useRemote';
import { C, F, RTL, card, faNum, right, row, shadow, tRight } from '../../zp/base';
import { Fill, Tile } from '../../zp/brand';
import { Icon } from '../../zp/Icon';
import { SubScreen } from '../../zp/Shell';
import { Async, ErrorBox, Press, StatusPill, T, useToast } from '../../zp/ui';

function Header({ t, onClose, closing }: { t: AppTicketDetail; onClose: () => void; closing: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  return (
    <View style={[{ borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, gap: 10 }, card]}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 12 }}>
        <Tile icon={t.icon} size={42} />
        <View style={{ flex: 1, alignItems: right, gap: 2 }}>
          <T w="b" size={15.5} style={{ lineHeight: 25 }} accessibilityRole="header">{t.subject}</T>
          <T size={11} color={C.muted}>{t.code} · {t.categoryLabel}</T>
        </View>
      </View>
      <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderStyle: 'dashed', borderColor: C.line, paddingTop: 9 }}>
        <View style={{ flexDirection: row, alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <StatusPill label={t.status.label} tone={t.status.tone} />
          {t.order ? (
            <Pressable accessibilityRole="link" onPress={() => router.navigate('/orders')} hitSlop={6}>
              <T w="b" size={11.5} color={C.goldText}>سفارش {t.order.code}</T>
            </Pressable>
          ) : <T size={11.5} color={C.muted}>{t.createdWhen}</T>}
        </View>
        {!t.closed ? (
          <Pressable accessibilityRole="button" disabled={closing} hitSlop={8}
            onPress={() => { if (confirm) { setConfirm(false); onClose(); } else setConfirm(true); }}>
            <T w="b" size={11.5} color={C.danger} style={{ opacity: closing ? 0.5 : 1 }}>
              {closing ? 'در حال بستن…' : confirm ? 'برای بستن دوباره بزنید' : 'بستن تیکت'}
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Physical left in a column (the customer's own bubbles sit on the reading-start side, the right). */
const left = (RTL ? 'flex-end' : 'flex-start') as 'flex-start' | 'flex-end';
/** Sharp corner on the physical top-right / top-left (RN mirrors left/right radii under RTL). */
const tailRight = RTL ? { borderTopLeftRadius: 6 } : { borderTopRightRadius: 6 };
const tailLeft = RTL ? { borderTopRightRadius: 6 } : { borderTopLeftRadius: 6 };

function Bubble({ mine, body, when, sending }: { mine: boolean; body: string; when: string; sending?: boolean }) {
  return (
    <View style={{ maxWidth: '86%', alignSelf: mine ? right : left, alignItems: mine ? right : left, gap: 4, opacity: sending ? 0.6 : 1 }}>
      {!mine ? (
        <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
          <Tile icon="chat" variant="gold" size={22} />
          <T w="b" size={11} color={C.goldText}>پشتیبانی زُحل پی</T>
        </View>
      ) : null}
      {mine ? (
        <View style={[{ borderRadius: 18, ...tailRight, overflow: 'hidden', paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: C.rim }, shadow(10, 20, 0.25, '#0A1238')]}>
          <Fill kind="enamel" />
          <T size={13.8} color="#fff" style={{ lineHeight: 27, writingDirection: 'auto' }} selectable>{body}</T>
        </View>
      ) : (
        <View style={[{ borderRadius: 18, ...tailLeft, paddingVertical: 10, paddingHorizontal: 14 }, card]}>
          <T size={13.8} style={{ lineHeight: 27, writingDirection: 'auto' }} selectable>{body}</T>
        </View>
      )}
      <T size={10.4} color={C.muted}>{sending ? 'در حال ارسال…' : mine ? `شما · ${when}` : when}</T>
    </View>
  );
}

export function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticket = useRemote(() => supportApi.ticket(id), [id]);
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const len = Array.from(draft.trim()).length;
  const closed = ticket.data?.ticket.closed ?? false;

  const send = async () => {
    if (pending) return;
    if (len < BODY_MIN) return setError('متن پیام را بنویسید.');
    if (len > BODY_MAX) return setError(`متن پیام حداکثر ${faNum(BODY_MAX)} حرف است.`);
    const body = draft;
    setPending(body.trim()); setDraft(''); setError(null);
    try {
      const r = await supportApi.reply(id, body);
      toast.show(r.reopened ? 'تیکت دوباره باز شد و پیام ارسال شد' : 'پیام ارسال شد');
      ticket.reload();
    } catch (e) {
      setDraft(body);
      setError(errorText(e, 'پیام ارسال نشد. دوباره تلاش کنید.'));
    } finally {
      setPending(null);
    }
  };

  const close = async () => {
    setClosing(true); setError(null);
    try { await supportApi.close(id); toast.show('تیکت بسته شد'); ticket.reload(); }
    catch (e) { setError(errorText(e, 'بستن تیکت انجام نشد.')); }
    finally { setClosing(false); }
  };

  const composer = ticket.status === 'success' ? (
    <View style={{ gap: 8 }}>
      {error ? <ErrorBox text={error} /> : null}
      <View style={{ flexDirection: row, alignItems: 'flex-end', gap: 8 }}>
        <TextInput value={draft} onChangeText={setDraft} multiline accessibilityLabel="متن پیام"
          placeholder={closed ? 'پیام بدهید تا تیکت دوباره باز شود…' : 'پیام خود را بنویسید…'} placeholderTextColor={C.subtle}
          style={[{ flex: 1, minHeight: 50, maxHeight: 140, fontFamily: F.m, fontSize: 14.2, lineHeight: 24, color: C.ink, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, textAlign: tRight, writingDirection: 'rtl' }, card]} />
        <Press accessibilityRole="button" accessibilityLabel="ارسال پیام" disabled={!!pending || len < BODY_MIN} onPress={send}
          style={[{ width: 50, height: 50, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: pending || len < BODY_MIN ? 0.5 : 1 }, shadow(8, 16, 0.35, '#7a5218')]}>
          <Fill kind="metal" vertical />
          <View style={{ transform: [{ scaleX: -1 }] }}><Icon name="share" size={21} color={C.onGold} /></View>
        </Press>
      </View>
    </View>
  ) : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SubScreen title="گفتگوی پشتیبانی" footer={composer} overlay={toast.node}>
        <Async state={ticket} retry={ticket.retry}>
          {({ ticket: t }) => (
            <>
              <Header t={t} onClose={close} closing={closing} />
              <View style={{ flexDirection: row, gap: 8, alignItems: 'flex-start', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line }}>
                <Icon name={t.closed ? 'info' : 'clock'} size={17} color={C.gold3} />
                <T size={12.3} color={C.ink2} style={{ flex: 1, lineHeight: 22 }}>{t.status.note}</T>
              </View>
              <View style={{ gap: 12 }} accessibilityLabel="پیام‌ها">
                {t.messages.map(m => <Bubble key={m.id} mine={m.mine} body={m.body} when={m.when} />)}
                {pending ? <Bubble mine body={pending} when="" sending /> : null}
              </View>
            </>
          )}
        </Async>
      </SubScreen>
    </KeyboardAvoidingView>
  );
}
