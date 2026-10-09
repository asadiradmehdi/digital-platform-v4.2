import { useRef, useState } from 'react';
import { Linking, ScrollView, TextInput, View } from 'react-native';
import { TOPUP_PRESETS_TOMAN, parseTomanInput, tomanToRial, topupAmountProblem } from '@digital-platform/api-contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { appApi, errorText, newIdempotencyKey, siteUrl, type AppOverview, type AppWalletEntry } from '../../api/app';
import { formatQuantityWords, formatTomanNumber, magnitudeParts } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { C, F, card, faNum, fwd, right, row, shadow } from '../../zp/base';
import { WalletCard } from '../../zp/cards';
import { Icon } from '../../zp/Icon';
import { AppScreen } from '../../zp/Shell';
import { Async, Cta, EmptyState, ErrorBox, Press, SecHead, Sheet, T, useToast } from '../../zp/ui';


function TxIcon({ t }: { t: AppWalletEntry }) {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.credit ? C.turquoiseSoft : C.surface2 }}>
      <Icon name={t.icon} size={19} color={t.credit ? C.turquoiseInk : C.ink2} />
    </View>
  );
}

const signed = (t: AppWalletEntry) => `${t.credit ? '+' : '−'} ${formatTomanNumber(t.amountToman)}`;

function Panel({ o, reload, initialAmount }: { o: AppOverview; reload: () => void; initialAmount: number | null }) {
  const w = o.wallet!;
  const toast = useToast();
  const [toman, setToman] = useState<number | null>(initialAmount ?? 1_000_000);
  // Arriving from a short-balance order (wallet?amount=…) prefills the exact amount needed.
  const [text, setText] = useState(initialAmount ? formatTomanNumber(initialAmount) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hist, setHist] = useState(false);
  const idem = useRef<string | null>(null);
  const problem = toman == null ? 'مبلغ را به تومان وارد کنید.' : topupAmountProblem(toman);
  const words = toman ? `${formatQuantityWords(toman)} تومان` : '';
  const pick = (a: number) => { setToman(a); setText(''); idem.current = null; setError(null); };
  const type = (raw: string) => {
    const n = raw.trim() ? parseTomanInput(raw) : null;
    setToman(n); idem.current = null; setError(null);
    setText(n == null ? raw.replace(/[^\d۰-۹٠-٩٬,]/g, '') : formatTomanNumber(n));
  };

  const topup = async () => {
    if (!o.workspaceId) return;
    if (problem || toman == null) { setError(problem); return; }
    setBusy(true); setError(null);
    idem.current ??= newIdempotencyKey();
    try {
      // The server creates a gateway payment for the chosen toman amount; the balance changes only
      // after the gateway confirms the payment, so the screen reloads when the customer returns.
      const { checkoutUrl } = await appApi.topUp({ workspaceId: o.workspaceId, amountToman: toman }, idem.current);
      idem.current = null;
      await Linking.openURL(/^https?:\/\//.test(checkoutUrl) ? checkoutUrl : siteUrl(checkoutUrl));
      toast.show('پس از پرداخت، موجودی به‌روز می‌شود');
      reload();
    } catch (e) {
      setError(errorText(e, 'افزایش موجودی انجام نشد.'));
    } finally {
      setBusy(false);
    }
  };

  const last = w.entries[0];
  return (
    <>
      <WalletCard balanceToman={w.balanceToman} tierName={o.tier.name} tail={w.walletId.slice(-4).toUpperCase()} />
      <SecHead title="افزایش موجودی" />
      <View accessibilityRole="radiogroup" accessibilityLabel="مبلغ افزایش موجودی" style={{ flexDirection: row, flexWrap: 'wrap', rowGap: 8, columnGap: 8 }}>
        {TOPUP_PRESETS_TOMAN.map(a => {
          const m = magnitudeParts(a);
          const on = a === toman;
          return (
            <Press key={a} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${formatQuantityWords(a)} تومان`}
              onPress={() => pick(a)}
              style={[{ width: '31.6%', borderRadius: 16, paddingVertical: 10, alignItems: 'center' }, card, on && [{ borderWidth: 2, borderColor: C.gold2 }, shadow(8, 18, 0.4, '#7a5218')]]}>
              <T w="b" size={17} style={{ textAlign: 'center' }}>{m.value}</T>
              <T size={10} color={C.muted} style={{ textAlign: 'center' }}>{m.unit} تومان</T>
            </Press>
          );
        })}
      </View>
      <View style={[{ flexDirection: row, alignItems: 'center', gap: 10, height: 52, borderRadius: 16, paddingHorizontal: 16 }, card,
        text ? { borderWidth: 2, borderColor: problem ? C.danger : C.gold2 } : null]}>
        <TextInput value={text} onChangeText={type} keyboardType="number-pad" placeholder="یا مبلغ دلخواه را بنویسید" placeholderTextColor={C.subtle}
          accessibilityLabel="مبلغ دلخواه به تومان" selectionColor={C.gold2} returnKeyType="done" onSubmitEditing={topup}
          style={{ flex: 1, color: C.ink, fontFamily: F.b, fontSize: 18, textAlign: 'right', paddingVertical: 0 }} />
        <T w="b" size={12.5} color={C.muted}>تومان</T>
      </View>
      {text ? (
        <T size={11.5} color={problem ? C.danger : C.muted} style={{ marginTop: -4, paddingHorizontal: 4 }}>
          {problem ?? `معادل ${formatTomanNumber(tomanToRial(toman!))} ریال در درگاه`}
        </T>
      ) : null}
      {error ? <ErrorBox text={error} /> : null}
      <Cta full label={busy ? 'در حال انجام…' : problem ? 'مبلغ را وارد کنید' : `پرداخت ${words}`} busy={busy} onPress={topup} />

      {last ? (
        <Press accessibilityRole="button" accessibilityHint="نمایش همه‌ی تراکنش‌ها" onPress={() => setHist(true)}
          style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 12 }, card]}>
          <TxIcon t={last} />
          <View style={{ flex: 1, alignItems: right }}>
            <T w="b" size={13.5}>{last.title}</T>
            <T size={11} color={C.muted}>آخرین تراکنش · {last.when}</T>
          </View>
          <T w="b" size={13.5} color={last.credit ? C.turquoiseInk : C.ink}>{signed(last)}</T>
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: C.line }} />
          <View style={{ flexDirection: row, alignItems: 'center', gap: 2 }}>
            <T w="b" size={10.5} color={C.goldText}>همه</T>
            <Icon name={fwd} size={14} color={C.goldText} stroke={2.4} />
          </View>
        </Press>
      ) : (
        <View style={[{ borderRadius: 18, padding: 14, alignItems: 'center' }, card]}><T size={13} color={C.muted}>هنوز تراکنشی ثبت نشده است</T></View>
      )}

      <Sheet open={hist} onClose={() => setHist(false)} title="تراکنش‌های کیف پول" subtitle={`${faNum(w.entries.length)} تراکنش اخیر`} icon="hist">
        <ScrollView style={{ flexGrow: 0 }}>
          {w.entries.map((t, i) => (
            <View key={t.id} style={{ flexDirection: row, alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: i === w.entries.length - 1 ? 0 : 1, borderStyle: 'dashed', borderColor: C.line }}>
              <TxIcon t={t} />
              <View style={{ flex: 1, alignItems: right }}>
                <T w="sb" size={13}>{t.title}</T>
                <T size={10.5} color={C.muted}>{t.when}</T>
              </View>
              <T w="b" size={13} color={t.credit ? C.turquoiseInk : C.ink}>{signed(t)}</T>
            </View>
          ))}
        </ScrollView>
      </Sheet>
      {toast.node}
    </>
  );
}

export function WalletScreen() {
  const router = useRouter();
  const overview = useRemote(appApi.overview);
  const { amount } = useLocalSearchParams<{ amount?: string }>();
  const asked = parseTomanInput(amount ?? '');
  const initialAmount = asked && !topupAmountProblem(asked) ? asked : null;
  return (
    <AppScreen>
      <Async state={overview} retry={overview.retry}>
        {o => o.wallet && o.workspaceId
          ? <Panel key={initialAmount ?? 'none'} o={o} reload={overview.reload} initialAmount={initialAmount} />
          : <EmptyState icon="wallet" title="کیف پولی پیدا نشد" text="برای این حساب هنوز کیف پول ساخته نشده است. با پشتیبانی در تماس باشید." action={{ label: 'پشتیبانی', onPress: () => router.navigate('/support') }} />}
      </Async>
    </AppScreen>
  );
}
