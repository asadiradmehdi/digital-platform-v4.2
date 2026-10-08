import { useState } from 'react';
import { Linking, View, type StyleProp, type ViewStyle } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { errorText, siteUrl } from '../../api/app';
import { invoicesApi, type AppInvoice, type AppInvoiceField } from '../../api/invoices';
import { formatTomanNumber } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { C, RTL, card, faNum, right, row } from '../../zp/base';

/** Cross-axis value for the physical left edge of a column (the end side in RTL). */
const left = (RTL ? 'flex-end' : 'flex-start') as 'flex-end' | 'flex-start';
import { BrandMark, Enamel, Ornament } from '../../zp/brand';
import { SubScreen } from '../../zp/Shell';
import { Async, Cta, EmptyState, ErrorBox, Star, T } from '../../zp/ui';
import { ltr } from './InvoicesScreen';

const show = (f: AppInvoiceField) => (f.ltr ? ltr(f.value) : f.value);

function Fields({ fields }: { fields: AppInvoiceField[] }) {
  return (
    <>
      {fields.map(f => (
        <View key={f.label} style={{ flexDirection: row, justifyContent: 'space-between', gap: 10 }}>
          <T size={12} color={C.muted}>{f.label}</T>
          <T w="sb" size={12} style={{ flexShrink: 1 }}>{show(f)}</T>
        </View>
      ))}
    </>
  );
}

function Head({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
      <Star size={11} />
      <T w="b" size={11.5} color={C.goldText}>{title}</T>
    </View>
  );
}

function Line({ label, toman, strong, minus }: { label: string; toman: number; strong?: boolean; minus?: boolean }) {
  return (
    <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 8, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: C.line }}>
      <T size={12} color={C.muted}>{label}</T>
      <T w={strong ? 'b' : 'sb'} size={12.5} color={minus ? C.success : C.ink}>{minus ? '− ' : ''}{formatTomanNumber(toman)} <T size={9.5} color={C.muted}>تومان</T></T>
    </View>
  );
}

function Document({ inv }: { inv: AppInvoice }) {
  const receipt = inv.type === 'TOPUP_RECEIPT';
  const t = inv.totals;
  const panel: StyleProp<ViewStyle> = [{ borderRadius: 18, padding: 14, gap: 6 }, card];
  return (
    <>
      <Enamel radius={26} style={{ padding: 18, gap: 16 }}>
        <Ornament w={400} h={200} cx={60} cy={220} rot={-14} color={C.gold1} alpha={0.5} />
        <View style={{ flexDirection: row, alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
            <BrandMark size={40} />
            <T w="dx" size={19} color="#fff">زُحل <T w="dx" size={19} color={C.gold1}>پی</T></T>
          </View>
          <View style={{ alignItems: left, gap: 6 }}>
            <T w="dx" size={17} color={C.gold1} accessibilityRole="header">{inv.typeLabel}</T>
            <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: C.rim }}>
              <T w="sb" size={12} color="rgba(255,255,255,0.9)">{ltr(inv.number)}</T>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: row, gap: 6 }}>
          {[['تاریخ صدور', inv.dateLabel], ['ساعت', inv.timeLabel], ['وضعیت', inv.statusLabel]].map(([k, v]) => (
            <View key={k} style={{ flex: 1, gap: 3, padding: 9, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(242,211,144,0.22)' }}>
              <T size={10} color="rgba(255,255,255,0.66)">{k}</T>
              <T w="b" size={12.5} color={k === 'وضعیت' ? C.gold1 : '#fff'} numberOfLines={1}>{v}</T>
            </View>
          ))}
        </View>
      </Enamel>

      <View style={panel}>
        <Head title={receipt ? 'دریافت‌کننده' : 'فروشنده'} />
        <T w="b" size={15}>{inv.seller.name}</T>
        <Fields fields={inv.seller.fields} />
      </View>
      <View style={panel}>
        <Head title={receipt ? 'پرداخت‌کننده' : 'خریدار'} />
        <T w="b" size={15}>{inv.buyer.name}</T>
        <Fields fields={inv.buyer.fields} />
      </View>

      <View style={[{ borderRadius: 18, paddingVertical: 4 }, card]}>
        {inv.items.map((it, i) => (
          <View key={it.row} style={{ padding: 14, gap: 5, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, borderStyle: 'dashed' }}>
            <View style={{ flexDirection: row, gap: 8, alignItems: 'baseline' }}>
              <T size={11} color={C.subtle}>{faNum(it.row)}</T>
              <T w="b" size={14} style={{ flex: 1 }}>{it.description}</T>
            </View>
            {it.details.map(d => <T key={d.label} size={11.5} color={C.muted}>{d.label}: {show(d)}</T>)}
            <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
              <T size={12} color={C.muted}>تعداد</T><T w="sb" size={12}>{it.quantityLabel}</T>
            </View>
            <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
              <T size={12} color={C.muted}>مبلغ واحد</T><T w="sb" size={12}>{formatTomanNumber(it.unitPriceToman)} تومان</T>
            </View>
            <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
              <T size={12} color={C.muted}>مبلغ کل</T><T w="b" size={12.5}>{formatTomanNumber(it.totalToman)} تومان</T>
            </View>
          </View>
        ))}
      </View>

      <View style={[{ borderRadius: 18, overflow: 'hidden' }, card]}>
        <View style={{ paddingVertical: 8, paddingHorizontal: 14, flexDirection: row, justifyContent: 'space-between' }}>
          <T size={12} color={C.muted}>جمع اقلام</T>
          <T w="sb" size={12.5}>{formatTomanNumber(t.subtotalToman)} <T size={9.5} color={C.muted}>تومان</T></T>
        </View>
        {t.discountToman > 0 ? <Line label="تخفیف" toman={t.discountToman} minus /> : null}
        {t.vat ? <Line label="مبلغ پیش از مالیات" toman={t.vat.netToman} /> : null}
        {t.vat ? <Line label={`مالیات بر ارزش افزوده (${t.vat.rateLabel})`} toman={t.vat.amountToman} /> : null}
        <View style={{ backgroundColor: C.accentStrong, paddingVertical: 12, paddingHorizontal: 14, flexDirection: row, justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T w="b" size={12.5} color={C.gold1}>{receipt ? 'مبلغ واریزی' : 'مبلغ پرداخت‌شده'}</T>
          <T w="b" size={19} color="#fff">{formatTomanNumber(t.totalToman)} <T size={10} color="rgba(255,255,255,0.7)">تومان</T></T>
        </View>
      </View>
      <View style={{ borderRadius: 16, padding: 12, gap: 3, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, ...(RTL ? { borderLeftWidth: 3, borderLeftColor: C.gold2 } : { borderRightWidth: 3, borderRightColor: C.gold2 }) }}>
        <T size={10.5} color={C.muted}>مبلغ به حروف</T>
        <T w="b" size={13.5} style={{ lineHeight: 26 }}>{t.totalWords}</T>
      </View>

      <View style={panel}>
        <Head title="جزئیات پرداخت" />
        <Fields fields={[
          { label: 'روش پرداخت', value: inv.payment.methodLabel },
          { label: 'زمان پرداخت', value: inv.payment.paidLabel },
          ...(inv.payment.orderCode ? [{ label: 'کد پیگیری سفارش', value: inv.payment.orderCode, ltr: true }] : []),
          ...(inv.payment.reference ? [{ label: 'شماره مرجع', value: inv.payment.reference, ltr: true }] : []),
        ]} />
      </View>
      <View style={{ gap: 2, alignItems: right }}>
        {inv.notes.map(n => <T key={n} size={11} color={C.muted} style={{ lineHeight: 20 }}>{n}</T>)}
      </View>
    </>
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
