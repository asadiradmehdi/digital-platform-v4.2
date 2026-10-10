import { useState } from 'react';
import { Linking, View, type StyleProp, type ViewStyle } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { errorText, siteUrl } from '../../api/app';
import { invoicesApi, type AppInvoice } from '../../api/invoices';
import { formatTomanNumber } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { C, RTL, card, faNum, right, row } from '../../zp/base';

/** Cross-axis value for the physical left edge of a column (the end side in RTL). */
const left = (RTL ? 'flex-end' : 'flex-start') as 'flex-end' | 'flex-start';
import { BrandMark, Enamel, Ornament } from '../../zp/brand';
import { SubScreen } from '../../zp/Shell';
import { Async, Cta, EmptyState, ErrorBox, Star, T } from '../../zp/ui';
import { ltr } from './InvoicesScreen';

function Line({ label, toman, strong, minus }: { label: string; toman: number; strong?: boolean; minus?: boolean }) {
  return (
    <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 8, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: C.line }}>
      <T size={12} color={C.muted}>{label}</T>
      <T w={strong ? 'b' : 'sb'} size={12.5} color={minus ? C.success : C.ink}>{minus ? '− ' : ''}{formatTomanNumber(toman)} <T size={9.5} color={C.muted}>تومان</T></T>
    </View>
  );
}

function Cell({ k, v, strong, flex = 1 }: { k: string; v: string; strong?: boolean; flex?: number }) {
  return (
    <View style={{ flex, gap: 2 }}>
      <T size={9.5} color={C.muted}>{k}</T>
      <T w={strong ? 'b' : 'sb'} size={12} numberOfLines={1}>{v}</T>
    </View>
  );
}

/** One screen, no scrolling: brand header, amount, the order line, parties, payment and the accepted-terms line. */
function Document({ inv }: { inv: AppInvoice }) {
  const receipt = inv.type === 'TOPUP_RECEIPT';
  const t = inv.totals;
  const first = inv.items[0];
  const more = inv.items.length - 1;
  const target = first?.details.find(d => d.ltr);
  const sellerId = inv.seller.fields.find(f => f.label === 'شناسه ملی');
  const terms = inv.notes.find(n => n.includes('قوانین'));
  return (
    <View style={{ flex: 1, gap: 10 }}>
      <Enamel radius={24} style={{ padding: 16, gap: 12 }}>
        <Ornament w={400} h={200} cx={60} cy={220} rot={-14} color={C.gold1} alpha={0.5} />
        <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
            <BrandMark size={34} />
            <T w="dx" size={17} color="#fff">زُحل <T w="dx" size={17} color={C.gold1}>پی</T></T>
          </View>
          <View style={{ alignItems: left, gap: 4 }}>
            <T w="dx" size={15} color={C.gold1} accessibilityRole="header">{inv.typeLabel}</T>
            <T w="sb" size={11} color="rgba(255,255,255,0.85)">{ltr(inv.number)}</T>
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T size={10.5} color="rgba(255,255,255,0.68)">{receipt ? 'مبلغ واریزی' : 'مبلغ پرداخت‌شده'}</T>
          <T w="dx" size={30} color="#fff" style={{ lineHeight: 42 }}>{formatTomanNumber(t.totalToman)} <T size={12} color={C.gold1}>تومان</T></T>
          <T size={10.5} color="rgba(255,255,255,0.72)" style={{ textAlign: 'center' }} numberOfLines={2}>{t.totalWords}</T>
        </View>
        <View style={{ flexDirection: row, gap: 6 }}>
          {[['تاریخ (تهران)', inv.dateLabel], ['ساعت', inv.timeLabel], ['وضعیت', inv.statusLabel]].map(([k, v]) => (
            <View key={k} style={{ flex: 1, gap: 2, padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(242,211,144,0.22)' }}>
              <T size={9.5} color="rgba(255,255,255,0.66)">{k}</T>
              <T w="b" size={12} color={k === 'وضعیت' ? C.gold1 : '#fff'} numberOfLines={1}>{v}</T>
            </View>
          ))}
        </View>
      </Enamel>

      <View style={[{ borderRadius: 18, padding: 13, gap: 9 }, card]}>
        {first ? (
          <>
            <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
              <Star size={10} />
              <T w="b" size={13.5} style={{ flex: 1 }} numberOfLines={2}>{first.description}</T>
            </View>
            <View style={{ flexDirection: row, gap: 8 }}>
              <Cell k="تعداد" v={first.quantityLabel} />
              <Cell k="مبلغ واحد" v={`${formatTomanNumber(first.unitPriceToman)} تومان`} />
              <Cell k="مبلغ کل" v={`${formatTomanNumber(first.totalToman)} تومان`} strong />
            </View>
            {target ? <T size={11} color={C.muted} numberOfLines={1}>{target.label}: {ltr(target.value)}</T> : null}
            {more > 0 ? <T size={10.5} color={C.goldText}>و {faNum(more)} قلم دیگر در همین فاکتور</T> : null}
          </>
        ) : null}
        {t.discountToman > 0 ? <Line label="تخفیف" toman={t.discountToman} minus /> : null}
        {t.vat ? <Line label={`مالیات بر ارزش افزوده (${t.vat.rateLabel})`} toman={t.vat.amountToman} /> : null}
      </View>

      <View style={[{ borderRadius: 18, padding: 13, gap: 9 }, card]}>
        <View style={{ flexDirection: row, gap: 8 }}>
          <Cell flex={1} k={receipt ? 'دریافت‌کننده' : 'فروشنده'} v={inv.seller.name} strong />
          <Cell flex={1} k={receipt ? 'پرداخت‌کننده' : 'خریدار'} v={inv.buyer.name} strong />
        </View>
        <View style={{ flexDirection: row, gap: 8 }}>
          <Cell k="روش پرداخت" v={inv.payment.methodLabel} />
          <Cell k="زمان پرداخت" v={inv.payment.paidLabel} />
        </View>
        <View style={{ flexDirection: row, gap: 8 }}>
          {inv.payment.orderCode ? <Cell k="کد پیگیری سفارش" v={ltr(inv.payment.orderCode)} /> : null}
          {inv.payment.reference ? <Cell k="شماره مرجع" v={ltr(inv.payment.reference)} /> : null}
          {!inv.payment.orderCode && !inv.payment.reference && sellerId ? <Cell k={sellerId.label} v={ltr(sellerId.value)} /> : null}
        </View>
      </View>

      <View style={{ borderRadius: 14, padding: 10, gap: 2, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, ...(RTL ? { borderLeftWidth: 3, borderLeftColor: C.gold2 } : { borderRightWidth: 3, borderRightColor: C.gold2 }) }}>
        <T size={10.5} color={C.muted} style={{ lineHeight: 17 }}>{terms ?? inv.notes[0]}</T>
      </View>
    </View>
  );
}

/** One invoice / top-up receipt in the v6 brand. «اشتراک‌گذاری / ذخیره PDF» opens the printable web copy. */
export function InvoiceScreen() {
  const { id, ws } = useLocalSearchParams<{ id: string; ws?: string }>();
  const data = useRemote(() => invoicesApi.get(String(ws ?? ''), String(id)), [id, ws]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPdf = async () => {
    setBusy(true); setError(null);
    try {
      // A fresh view link each time: it is short-lived and read-only, for this invoice only.
      const fresh = await invoicesApi.get(String(ws ?? ''), String(id));
      await Linking.openURL(siteUrl(fresh.webPath));
    } catch (e) {
      setError(errorText(e, 'باز کردن نسخه‌ی PDF انجام نشد.'));
    } finally { setBusy(false); }
  };

  return (
    <SubScreen
      title={data.data?.invoice.typeLabel ?? 'فاکتور'}
      fixed
      footer={data.status === 'success' ? <View style={{ gap: 8 }}>{error ? <ErrorBox text={error} /> : null}<Cta full icon="share" label="اشتراک‌گذاری / ذخیره PDF" busy={busy} onPress={openPdf} /></View> : undefined}
    >
      {!ws ? (
        <EmptyState icon="doc" title="فاکتور پیدا نشد" text="این فاکتور را از فهرست فاکتورها باز کنید." />
      ) : (
        <Async state={data} retry={data.retry}>{d => <Document inv={d.invoice} />}</Async>
      )}
    </SubScreen>
  );
}
