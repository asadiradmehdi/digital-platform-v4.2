import { useWindowDimensions } from 'react-native';
import { appApi } from '../../api/app';
import { useRemote } from '../../hooks/useRemote';
import { faNum } from '../../zp/base';
import { CategoryGrid, WalletStrip } from '../../zp/cards';
import { Promo, type PromoSlide } from '../../zp/Promo';
import { AppScreen } from '../../zp/Shell';
import { Async, SecHead } from '../../zp/ui';

const SLIDES: PromoSlide[] = [
  { kicker: 'پرفروش‌ترین', title: 'فالوور اینستاگرام', text: 'ثبت در چند ثانیه · پیگیری لحظه‌ای وضعیت', icon: 'user', href: { pathname: '/order/[service]', params: { service: 'ig-followers' } }, goldTile: true },
  { kicker: 'کیف پول زُحل پی', title: 'شارژ کن، بی‌معطلی بخر', text: 'پرداخت سفارش‌ها مستقیم از موجودی', icon: 'wallet', href: '/wallet', kind: 'goldLight' },
  { kicker: 'تلگرام', title: 'ممبر کانال تلگرام', text: 'انتخاب بسته، پرداخت و پیگیری در یک صفحه', icon: 'tg', href: { pathname: '/order/[service]', params: { service: 'tg-members' } }, kind: 'turquoiseLapis', goldTile: true },
];

export function HomeScreen() {
  const { height } = useWindowDimensions();
  const catalog = useRemote(appApi.catalog);
  const overview = useRemote(appApi.overview);
  const o = overview.data;
  return (
    <AppScreen>
      <Promo slides={SLIDES} height={Math.round(Math.max(122, Math.min(162, height * 0.195)))} />
      <WalletStrip balanceToman={o?.wallet?.balanceToman ?? null} tierName={o?.tier.name ?? null} />
      <Async state={catalog} retry={catalog.retry}>
        {c => (
          <>
            <SecHead title="خدمات" note={`${faNum(c.categories.length)} دسته · ${faNum(c.services.length)} سرویس فعال`} />
            <CategoryGrid categories={c.categories} />
          </>
        )}
      </Async>
    </AppScreen>
  );
}
