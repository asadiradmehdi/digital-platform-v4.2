// تیکت جدید: category chips, optional recent order, subject and message; success routes to the thread.
// Mirrors app/support/new. The server validates everything again (lengths, category whitelist, order ownership).
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { appApi, BODY_MAX, BODY_MIN, errorText, SUBJECT_MAX, supportApi, type AppOrderCard, type AppSupport } from '../../api/app';
import { useRemote } from '../../hooks/useRemote';
import { C, F, card, faNum, right, row, tRight } from '../../zp/base';
import { Tile } from '../../zp/brand';
import { SubScreen } from '../../zp/Shell';
import { Async, Cta, EmptyState, ErrorBox, Press, SecHead, Sheet, T } from '../../zp/ui';

const WITH_ORDER = ['ORDER', 'PAYMENT', 'AI_SUBSCRIPTION'];
const count = (s: string) => Array.from(s.trim()).length;
const input = { fontFamily: F.m, fontSize: 14.5, color: C.ink, backgroundColor: C.surface2, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, textAlign: tRight, writingDirection: 'rtl' } as const;

function Label({ text, note, over }: { text: string; note?: string; over?: boolean }) {
  return (
    <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center' }}>
      <T w="sb" size={12.5} color={C.ink2}>{text}</T>
      {note ? <T w={over ? 'b' : 'm'} size={10.5} color={over ? C.danger : C.muted}>{note}</T> : null}
    </View>
  );
}

function Form({ s, initialCategory }: { s: AppSupport; initialCategory: string | null }) {
  const router = useRouter();
  const ws = s.workspaceId!;
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [orderId, setOrderId] = useState<string>('');
  const [orders, setOrders] = useState<AppOrderCard[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; code: string } | null>(null);

  useEffect(() => {
    let alive = true;
    appApi.orders(ws, 0).then(r => { if (alive) setOrders(r.items.slice(0, 6)); }).catch(() => { /* optional field */ });
    return () => { alive = false; };
  }, [ws]);

  const sLen = count(subject), mLen = count(message);
  const showOrders = orders.length > 0 && (category == null || WITH_ORDER.includes(category) || orderId !== '');
  const open = (id: string) => router.replace({ pathname: '/support/[id]', params: { id } });

  const submit = async () => {
    if (busy) return;
    if (!category) return setError('موضوع درخواست را انتخاب کنید.');
    if (!sLen) return setError('عنوان تیکت را بنویسید.');
    if (sLen > SUBJECT_MAX) return setError(`عنوان حداکثر ${faNum(SUBJECT_MAX)} حرف است.`);
    if (mLen < BODY_MIN) return setError('متن پیام را بنویسید.');
    if (mLen > BODY_MAX) return setError(`متن پیام حداکثر ${faNum(BODY_MAX)} حرف است.`);
    setBusy(true); setError(null);
    try {
      const r = await supportApi.create({ workspaceId: ws, category, orderId: orderId || undefined, subject, message });
      setDone(r.ticket);
    } catch (e) {
      setError(errorText(e, 'ثبت تیکت انجام نشد. دوباره تلاش کنید.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SecHead title="موضوع درخواست" note="یکی را انتخاب کنید" />
      <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
        {s.categories.map(c => {
          const on = category === c.key;
          return (
            <Press key={c.key} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={c.label}
              onPress={() => { setCategory(c.key); setError(null); }}
              style={[{ width: '48.6%', height: 58, flexDirection: row, alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 10 }, card, { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D9CCB2' }, on && { borderColor: C.gold2, borderWidth: 2, backgroundColor: '#FFF8E6' }]}>
              <Tile icon={c.icon} size={30} />
              <T w={on ? 'b' : 'sb'} size={12} color={on ? C.ink : C.ink2} style={{ flex: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{c.label}</T>
            </Press>
          );
        })}
      </View>

      {showOrders ? (
        <View style={{ gap: 7 }}>
          <Label text="سفارش مرتبط" note="اختیاری" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: row }}>
            {[{ id: '', code: 'بدون سفارش', title: '' } as Pick<AppOrderCard, 'id' | 'code' | 'title'>, ...orders].map(o => {
              const on = orderId === o.id;
              return (
                <Press key={o.id || 'none'} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.title ? `${o.code}، ${o.title}` : o.code}
                  onPress={() => setOrderId(o.id)}
                  style={[{ borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, maxWidth: 200, alignItems: right }, card, on && { borderColor: C.gold2, borderWidth: 2 }]}>
                  <T w="b" size={12.5} color={on ? C.ink : C.ink2}>{o.code}</T>
                  {o.title ? <T size={10.5} color={C.muted} numberOfLines={1}>{o.title}</T> : null}
                </Press>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ gap: 7 }}>
        <Label text="عنوان" note={`${faNum(sLen)} / ${faNum(SUBJECT_MAX)}`} over={sLen > SUBJECT_MAX} />
        <TextInput value={subject} onChangeText={setSubject} placeholder="مثلاً: سفارش فالوور هنوز شروع نشده" placeholderTextColor={C.subtle}
          maxLength={SUBJECT_MAX + 20} accessibilityLabel="عنوان تیکت" returnKeyType="next" style={input} />
      </View>
      <View style={{ gap: 7 }}>
        <Label text="شرح درخواست" note={`${faNum(mLen)} / ${faNum(BODY_MAX)}`} over={mLen > BODY_MAX} />
        <TextInput value={message} onChangeText={setMessage} multiline textAlignVertical="top" accessibilityLabel="شرح درخواست"
          placeholder="جزئیات را بنویسید: چه اتفاقی افتاد، از کی، و چه انتظاری داشتید. رمز عبور یا کد تأیید را هرگز ننویسید." placeholderTextColor={C.subtle}
          style={[input, { minHeight: 120, lineHeight: 26 }]} />
      </View>

      {error ? <ErrorBox text={error} /> : null}
      <Cta full label={busy ? 'در حال ارسال…' : 'ارسال تیکت'} busy={busy} onPress={submit} />

      <Sheet open={!!done} onClose={() => done && open(done.id)} title="تیکت شما ثبت شد" subtitle={done?.code} icon="cmt">
        <T size={13} color={C.muted} style={{ lineHeight: 24 }}>کارشناسان ما در ساعات کاری پاسخ می‌دهند. پاسخ در همین گفتگو نمایش داده می‌شود.</T>
        <Cta full label="مشاهده‌ی گفتگو" onPress={() => done && open(done.id)} />
      </Sheet>
    </>
  );
}

export function NewTicketScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const support = useRemote('supportApi.overview', supportApi.overview);
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SubScreen title="تیکت جدید">
        <Async state={support} retry={support.retry}>
          {s => s.workspaceId
            ? <Form s={s} initialCategory={s.categories.some(c => c.key === category) ? category! : null} />
            : <EmptyState icon="info" title="فضای کاری فعالی ندارید" text="برای ثبت تیکت، حساب شما باید به یک فضای کاری فعال متصل باشد. با شماره‌های پشتیبانی تماس بگیرید." />}
        </Async>
      </SubScreen>
    </KeyboardAvoidingView>
  );
}
