import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { appApi } from '../../api/app';
import { invoicesApi, type AppInvoiceRow } from '../../api/invoices';
import { formatTomanNumber } from '../../format';
import { useRemote } from '../../hooks/useRemote';
import { C, RTL, back, card, faNum, fwd, right, row } from '../../zp/base';
import { Tile } from '../../zp/brand';
import { SubScreen } from '../../zp/Shell';
import { Async, EmptyState, IconBtn, Press, Rise, SecHead, T } from '../../zp/ui';

/** Unicode isolate so IDs/codes keep their LTR order inside a Persian line. */
export const ltr = (s: string) => `⁦${s}⁩`;

function InvoiceRow({ inv, onPress }: { inv: AppInvoiceRow; onPress: () => void }) {
  const receipt = inv.type === 'TOPUP_RECEIPT';
  return (
    <Press accessibilityRole="button" accessibilityLabel={`${inv.typeLabel} ${inv.title}، ${formatTomanNumber(inv.amountToman)} تومان`} onPress={onPress}
      style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 12 }, card]}>
      <Tile icon={receipt ? 'arrowIn' : 'doc'} variant={receipt ? 'gold' : 'enamel'} size={46} />
      <View style={{ flex: 1, minWidth: 0, gap: 2, alignItems: right }}>
        <T w="b" size={14.5} numberOfLines={1}>{inv.title}</T>
        <T size={11} color={C.muted} numberOfLines={1}>{ltr(inv.number)} · {inv.when}</T>
      </View>
      <View style={{ alignItems: RTL ? 'flex-end' : 'flex-start', gap: 4 }}>
        <T w="b" size={14}>{formatTomanNumber(inv.amountToman)} <T w="sb" size={10} color={C.goldText}>تومان</T></T>
        <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: receipt ? C.turquoiseSoft : C.accentSoft }}>
          <T w="b" size={9.5} color={receipt ? C.turquoiseInk : C.accent}>{inv.typeLabel}</T>
        </View>
      </View>
    </Press>
  );
}

function InvoiceList({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const list = useRemote(() => invoicesApi.list(workspaceId, page), [page]);
  return (
    <Async state={list} retry={list.retry}>
      {l => l.items.length ? (
        <>
          <T size={12} color={C.muted} style={{ lineHeight: 22 }}>پس از هر پرداخت، فاکتور خرید یا رسید شارژ کیف پول به‌صورت خودکار اینجا صادر می‌شود.</T>
          <View style={{ gap: 10 }}>
            {l.items.map((inv, i) => (
              <Rise key={inv.id} delay={Math.min(i, 8) * 60}>
                <InvoiceRow inv={inv} onPress={() => router.navigate({ pathname: '/invoices/[id]', params: { id: inv.id, ws: workspaceId } })} />
              </Rise>
            ))}
          </View>
          {page > 0 || l.hasMore ? (
            <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <IconBtn icon={back} label="فاکتورهای جدیدتر" size={34} onPress={() => page > 0 && setPage(page - 1)} />
              <T w="sb" size={12} color={C.muted}>صفحه‌ی {faNum(page + 1)}</T>
              <IconBtn icon={fwd} label="فاکتورهای قدیمی‌تر" size={34} onPress={() => l.hasMore && setPage(page + 1)} />
            </View>
          ) : null}
        </>
      ) : page > 0 ? (
        <EmptyState icon="doc" title="فاکتور دیگری نیست" text="همه‌ی فاکتورهایتان را دیده‌اید." action={{ label: 'بازگشت به اول فهرست', onPress: () => setPage(0) }} />
      ) : (
        <EmptyState icon="doc" title="هنوز فاکتوری ندارید" text="بعد از هر خرید یا شارژ کیف پول، فاکتور یا رسید آن با تاریخ، ساعت و جزئیات کامل همین‌جا ساخته می‌شود." action={{ label: 'مشاهده‌ی خدمات', onPress: () => router.navigate('/services') }} />
      )}
    </Async>
  );
}

/** «فاکتورها»: invoices and top-up receipts of the member's workspace. Mirrors web /invoices. */
export function InvoicesScreen() {
  const overview = useRemote(appApi.overview);
  return (
    <SubScreen title="فاکتورها">
      <SecHead title="فاکتورها و رسیدها" />
      <Async state={overview} retry={overview.retry}>
        {o => o.workspaceId
          ? <InvoiceList workspaceId={o.workspaceId} />
          : <EmptyState icon="doc" title="هنوز فاکتوری ندارید" text="برای این حساب فضای کاری فعالی پیدا نشد. با پشتیبانی در تماس باشید." />}
      </Async>
    </SubScreen>
  );
}
