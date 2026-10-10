import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { appApi } from '../../api/app';
import { useRemote } from '../../hooks/useRemote';
import { C, back, faNum, fwd, row } from '../../zp/base';
import { OrderCard } from '../../zp/cards';
import { AppScreen } from '../../zp/Shell';
import { Async, EmptyState, IconBtn, Rise, SecHead, T } from '../../zp/ui';

function OrderList({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const orders = useRemote('OrdersScreen.28', () => appApi.orders(workspaceId, page), [page]);
  return (
    <Async state={orders} retry={orders.retry}>
      {o => o.items.length ? (
        <>
          <View style={{ gap: 10 }}>{o.items.map((x, i) => <Rise key={x.id} delay={Math.min(i, 8) * 60}><OrderCard order={x} /></Rise>)}</View>
          {page > 0 || o.hasMore ? (
            <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <IconBtn icon={back} label="سفارش‌های جدیدتر" size={34} onPress={() => page > 0 && setPage(page - 1)} />
              <T w="sb" size={12} color={C.muted}>صفحه‌ی {faNum(page + 1)}</T>
              <IconBtn icon={fwd} label="سفارش‌های قدیمی‌تر" size={34} onPress={() => o.hasMore && setPage(page + 1)} />
            </View>
          ) : null}
        </>
      ) : page > 0 ? (
        <EmptyState icon="tOrders" title="سفارش دیگری نیست" text="همه‌ی سفارش‌هایتان را دیده‌اید." action={{ label: 'بازگشت به اول فهرست', onPress: () => setPage(0) }} />
      ) : (
        <EmptyState icon="tOrders" title="هنوز سفارشی ندارید" text="یک سرویس انتخاب کنید، بسته را بردارید و از کیف پول پرداخت کنید. پیشرفت سفارش همین‌جا نمایش داده می‌شود." action={{ label: 'مشاهده‌ی خدمات', onPress: () => router.navigate('/services') }} />
      )}
    </Async>
  );
}

export function OrdersScreen() {
  const overview = useRemote('appApi.overview', appApi.overview);
  const active = overview.data?.stats.activeOrders;
  return (
    <AppScreen>
      <SecHead title="سفارش‌های من" note={active != null ? `${faNum(active)} سفارش فعال` : undefined} />
      <Async state={overview} retry={overview.retry}>
        {o => o.workspaceId
          ? <OrderList workspaceId={o.workspaceId} />
          : <EmptyState icon="tOrders" title="هنوز سفارشی ندارید" text="برای این حساب فضای کاری فعالی پیدا نشد. با پشتیبانی در تماس باشید." />}
      </Async>
    </AppScreen>
  );
}
