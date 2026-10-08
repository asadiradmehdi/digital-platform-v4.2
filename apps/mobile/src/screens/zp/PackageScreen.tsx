import { useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { appApi, errorText, newIdempotencyKey, type AppService } from '../../api/app';
import { formatQuantityWords, formatTomanNumber, magnitudeParts } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { atLeft, C, F, back, card, fwd, right, row, shadow, tRight } from '../../zp/base';
import { BrandTile, Enamel, Fill, Ornament, Tile } from '../../zp/brand';
import { Icon } from '../../zp/Icon';
import { SubScreen } from '../../zp/Shell';
import { Async, Cta, EmptyState, ErrorBox, IconBtn, Press, Sheet, T, useToast } from '../../zp/ui';

const PER_PAGE = 9;

function Done({ done, onHome, onOrders }: { done: { id: string; label: string; amount: number } | null; onHome: () => void; onOrders: () => void }) {
  return (
    <Modal visible={!!done} animationType="fade" onRequestClose={onHome}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View accessibilityLiveRegion="polite" style={{ width: '100%', maxWidth: 360, alignItems: 'center', gap: 12 }}>
          <View style={{ width: 150, height: 110, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={150} height={110} viewBox="0 0 150 110" style={{ position: 'absolute' }}>
              <Ellipse cx="75" cy="55" rx="72" ry="24" rotation={-14} origin="75, 55" fill="none" stroke={C.gold2} strokeOpacity={0.55} strokeWidth={1.5} />
              <Ellipse cx="75" cy="55" rx="60" ry="18" rotation={-14} origin="75, 55" fill="none" stroke={C.gold2} strokeOpacity={0.3} strokeWidth={1} />
            </Svg>
            <View style={[{ width: 92, height: 92, borderRadius: 46, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, shadow(20, 40, 0.5, '#7a5218')]}>
              <Fill kind="metal" />
              <View style={{ position: 'relative', zIndex: 1 }}><Svg width={42} height={42} viewBox="0 0 24 24"><Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={C.onGold} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></Svg></View>
            </View>
          </View>
          <T w="dx" size={22} style={{ textAlign: 'center', marginTop: 6 }}>سفارش ثبت شد</T>
          <T size={13.5} color={C.muted} style={{ textAlign: 'center' }}>پرداخت انجام شد و سفارش در صف انجام است.</T>
          {done ? (
            <View style={[{ alignSelf: 'stretch', borderRadius: 20, padding: 16, gap: 9 }, card]}>
              <View style={{ flexDirection: row, justifyContent: 'space-between', gap: 10 }}><T color={C.muted} size={13.5}>سرویس</T><T w="b" size={13.5} style={{ flexShrink: 1 }}>{done.label}</T></View>
              <View style={{ flexDirection: row, justifyContent: 'space-between' }}><T color={C.muted} size={13.5}>کد پیگیری</T><T w="b" size={13.5}>{`ZP-${done.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`}</T></View>
              <View style={{ borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, marginHorizontal: 8 }} />
              <View style={{ flexDirection: row, justifyContent: 'space-between' }}><T color={C.muted} size={13.5}>مبلغ پرداختی</T><T w="b" size={13.5}>{formatTomanNumber(done.amount)} تومان</T></View>
            </View>
          ) : null}
          <Cta full label="پیگیری سفارش" onPress={onOrders} />
          <Pressable accessibilityRole="link" onPress={onHome} style={{ padding: 8 }}><T w="sb" color={C.muted} style={{ textAlign: 'center' }}>بازگشت به خانه</T></Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Picker({ service, workspaceId, walletToman, reload }: { service: AppService; workspaceId: string | null; walletToman: number | null; reload: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const pages = Math.max(1, Math.ceil(service.quantities.length / PER_PAGE));
  const [page, setPage] = useState(0);
  const [qty, setQty] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; label: string; amount: number } | null>(null);
  const idem = useRef<string | null>(null);

  // Short ladders (AI plans: 1/3/6/12 months) sit in a 2×2 block instead of a sparse 3×3.
  const few = service.quantities.length <= 4;
  const list = useMemo(() => service.quantities.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE), [service.quantities, page]);
  const price = qty ? qty * service.unitPriceToman : 0;
  const label = qty ? `${formatQuantityWords(qty)} ${service.unit} · ${service.name}` : '';
  const short = walletToman != null && qty != null && walletToman < price;

  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy),
    // RTL: swiping right reveals the next page.
    onPanResponderRelease: (_, g) => {
      if (g.dx > 40) setPage(p => Math.min(pages - 1, p + 1));
      else if (g.dx < -40) setPage(p => Math.max(0, p - 1));
    },
  }));

  const openSheet = () => {
    if (!qty) { toast.show('اول یک بسته انتخاب کنید'); return; }
    setError(null);
    idem.current = newIdempotencyKey();
    setSheet(true);
  };

  const pay = async () => {
    if (!qty || !workspaceId) return;
    const t = target.trim();
    if (!t) { setError(`${service.target.label} را وارد کنید.`); return; }
    setBusy(true); setError(null);
    try {
      const res = await appApi.placeOrder({ workspaceId, serviceId: service.id, quantity: qty, target: t }, idem.current ?? newIdempotencyKey());
      setSheet(false);
      setDone({ id: res.id, label: `${formatQuantityWords(qty)} ${service.name}`, amount: price });
      reload();
    } catch (e) {
      setError(errorText(e, 'ثبت سفارش انجام نشد. دوباره تلاش کنید.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 14 }}>
        {service.brand ? <BrandTile brand={service.brand} size={52} /> : <Tile icon={service.icon} size={52} />}
        <View style={{ flex: 1, alignItems: right }}>
          <T w="dx" size={18} style={{ lineHeight: 28 }}>{service.name}</T>
          <T size={12} color={C.muted} numberOfLines={2}>{service.description ?? 'ثبت آنی · پیگیری لحظه‌ای'}</T>
        </View>
      </View>

      <View {...pan.panHandlers} accessibilityLabel="بسته‌ها" style={few ? { height: 280, gap: 12 } : { flex: 1, minHeight: 300, maxHeight: 560, gap: 12 }}>
        {Array.from({ length: few ? 2 : 3 }, (_, r) => (
          <View key={r} style={{ flex: 1, flexDirection: row, gap: 10 }}>
            {Array.from({ length: few ? 2 : 3 }, (_, c) => {
              const q = list[r * (few ? 2 : 3) + c];
              if (q == null) return <View key={c} style={{ flex: 1 }} />;
              const m = magnitudeParts(q);
              const on = qty === q;
              return (
                <Press key={c} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  accessibilityLabel={`${formatQuantityWords(q)} ${service.unit}، ${formatTomanNumber(q * service.unitPriceToman)} تومان`}
                  onPress={() => setQty(q)}
                  style={[{ flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 4 }, card, on && [{ borderWidth: 2, borderColor: C.gold2 }, shadow(10, 22, 0.4, '#7a5218')]]}>
                  {on ? (
                    <View style={{ position: 'absolute', top: 8, ...atLeft(8), width: 18, height: 18, borderRadius: 9, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                      <Fill kind="metal" />
                      <View style={{ position: 'relative', zIndex: 1 }}><Svg width={11} height={11} viewBox="0 0 24 24"><Path d="M6.5 12.5l3.7 3.7 7.3-8" fill="none" stroke={C.onGold} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" /></Svg></View>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: row, alignItems: 'baseline', gap: 2 }}>
                    <T w="b" size={19}>{m.value}</T>
                    {m.unit ? <T w="sb" size={10.5} color={C.ink2}>{m.unit}</T> : null}
                  </View>
                  <T size={10.5} color={C.muted}>{service.unit}</T>
                  <View style={{ flexDirection: row, alignItems: 'baseline', gap: 3, marginTop: 6 }}>
                    <T w="b" size={13}>{formatTomanNumber(q * service.unitPriceToman)}</T>
                    <T w="sb" size={9.5} color={C.goldText}>تومان</T>
                  </View>
                </Press>
              );
            })}
          </View>
        ))}
      </View>

      {pages > 1 ? (
        <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <IconBtn icon={back} label="بسته‌های قبلی" size={34} onPress={() => page > 0 && setPage(page - 1)} />
          <View style={{ flexDirection: row, gap: 5 }}>
            {Array.from({ length: pages }, (_, i) => <View key={i} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 6, backgroundColor: i === page ? C.gold2 : C.line }} />)}
          </View>
          <IconBtn icon={fwd} label="بسته‌های بعدی" size={34} onPress={() => page < pages - 1 && setPage(page + 1)} />
        </View>
      ) : null}

      <Enamel radius={24} style={{ flexDirection: row, alignItems: 'center', gap: 12, padding: 12 }}>
        <Ornament w={400} h={80} cx={70} cy={80} rot={10} alpha={0.45} girih={false} />
        <Tile icon={service.icon} size={46} variant="ghost" />
        <View style={{ flex: 1, alignItems: right }}>
          <T size={10.5} color="rgba(255,255,255,0.66)">مبلغ نهایی</T>
          <View style={{ flexDirection: row, alignItems: 'baseline', gap: 4, opacity: qty ? 1 : 0.45 }}>
            <T w="b" size={18.5} color="#fff">{formatTomanNumber(price)}</T>
            <T size={11} color={C.gold1}>تومان</T>
          </View>
          <T w={qty ? 'sb' : 'm'} size={11} color={qty ? C.gold1 : 'rgba(255,255,255,0.72)'} numberOfLines={1}>{qty ? label : 'یک بسته از بالا انتخاب کنید'}</T>
        </View>
        <Cta big label="ادامه‌ی خرید" icon={fwd} onPress={openSheet} />
      </Enamel>

      <Sheet open={sheet} onClose={() => !busy && setSheet(false)} title="تکمیل سفارش" subtitle={label} icon={service.icon} dismissable={!busy}>
        <View style={{ gap: 7 }}>
          <T w="sb" size={12.5} color={C.ink2}>{service.target.label}</T>
          <TextInput
            value={target} onChangeText={setTarget} placeholder={service.target.placeholder} placeholderTextColor={C.subtle}
            autoCapitalize="none" autoCorrect={false} maxLength={500} accessibilityLabel={service.target.label}
            keyboardType={service.target.ltr ? 'url' : 'default'}
            style={{ fontFamily: F.m, fontSize: 14.5, color: C.ink, backgroundColor: C.surface2, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 14, textAlign: service.target.ltr ? (tRight === 'right' ? 'left' : 'right') : tRight }}
          />
        </View>
        <View style={{ backgroundColor: C.surface2, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 9 }}>
          <View style={{ flexDirection: row, justifyContent: 'space-between' }}><T size={13.5} color={C.ink2}>مبلغ بسته</T><T w="b" size={13.5}>{formatTomanNumber(price)} تومان</T></View>
          <View style={{ flexDirection: row, justifyContent: 'space-between' }}><T size={13.5} color={C.ink2}>موجودی کیف پول</T><T w="b" size={13.5} color={short ? C.danger : C.success}>{walletToman == null ? '—' : `${formatTomanNumber(walletToman)} تومان`}</T></View>
          <View style={{ flexDirection: row, justifyContent: 'space-between', borderTopWidth: 1, borderStyle: 'dashed', borderColor: C.muted, paddingTop: 9 }}><T size={15}>پرداخت از کیف پول</T><T w="b" size={15}>{formatTomanNumber(price)} تومان</T></View>
        </View>
        {short && !error ? <ErrorBox text="موجودی کافی نیست." action={{ label: 'افزایش موجودی', onPress: () => { setSheet(false); router.navigate('/wallet'); } }} /> : null}
        {error ? <ErrorBox text={error} /> : null}
        <Cta full label={busy ? 'در حال ثبت…' : 'پرداخت و ثبت سفارش'} busy={busy} disabled={!workspaceId} onPress={pay} />
        <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: -4 }}>
          <Icon name="shieldS" size={14} color={C.turquoiseInk} />
          <T size={11} color={C.muted} style={{ textAlign: 'center' }}>پرداخت امن از کیف پول · بازگشت وجه در صورت لغو</T>
        </View>
      </Sheet>

      <Done done={done} onHome={() => { setDone(null); router.navigate('/'); }} onOrders={() => { setDone(null); router.navigate('/orders'); }} />
      {toast.node}
    </>
  );
}

export function PackageScreen() {
  const router = useRouter();
  const { service: slug } = useLocalSearchParams<{ service: string }>();
  const catalog = useRemote(appApi.catalog);
  const overview = useRemote(appApi.overview);
  const service = catalog.data?.services.find(s => s.slug === slug);
  return (
    <SubScreen title={service?.name ?? 'سفارش جدید'}>
      <Async state={catalog} retry={catalog.retry}>
        {() => service
          ? <Picker service={service} workspaceId={overview.data?.workspaceId ?? null} walletToman={overview.data?.wallet?.balanceToman ?? null} reload={overview.reload} />
          : <EmptyState icon="box" title="سرویس پیدا نشد" text="این سرویس فعال نیست یا هنوز قیمت‌گذاری نشده است. از فهرست خدمات یک سرویس دیگر انتخاب کنید." action={{ label: 'مشاهده‌ی خدمات', onPress: () => router.navigate('/services') }} />}
      </Async>
    </SubScreen>
  );
}
