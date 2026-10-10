import { useWindowDimensions } from 'react-native';
import { appApi } from '../../api/app';
import { useRemote } from '../../hooks/useRemote';
import { faNum } from '../../zp/base';
import { CategoryGrid, WalletStrip } from '../../zp/cards';
import { Promo, type PromoSlide } from '../../zp/Promo';
import { AppScreen } from '../../zp/Shell';
import { Async, SecHead } from '../../zp/ui';

const SLIDES: PromoSlide[] = [
  { kicker: 'پرفروش‌ترین', title: 'فالوور اینستاگرام', text: 'ثبت در چند ثانیه | پیگیری لحظه‌ای وضعیت', icon: 'user', href: { pathname: '/order/[service]', params: { service: 'ig-followers' } }, goldTile: true },
  { kicker: 'کیف پول زُحل پی', title: 'شارژ کن، بی‌معطلی بخر', text: 'پرداخت سفارش‌ها مستقیم از موجودی', icon: 'wallet', href: '/wallet', kind: 'goldLight' },
  { kicker: 'تلگرام', title: 'ممبر کانال تلگرام', text: 'انتخاب بسته، پرداخت و پیگیری در یک صفحه', icon: 'tg', href: { pathname: '/order/[service]', params: { service: 'tg-members' } }, kind: 'turquoiseLapis', goldTile: true },
];

export function HomeScreen() {
  const { height } = useWindowDimensions();
  const catalog = useRemote('appApi.catalog', appApi.catalog);
  const overview = useRemote('appApi.overview', appApi.overview);
  const o = overview.data;
  // No-scroll screen: the promo takes a share of the height and the service grid fills whatever remains.
  const promoH = Math.round(Math.max(104, Math.min(140, height * 0.15)));
  return (
    <AppScreen fixed>
      <Promo slides={SLIDES} height={promoH} />
      <WalletStrip balanceToman={o?.wallet?.balanceToman ?? null} tierName={o?.tier.name ?? null} />
      <Async state={catalog} retry={catalog.retry}>
        {c => (
          <>
            <SecHead title="خدمات" note={`${faNum(c.categories.length)} دسته | ${faNum(c.services.length)} سرویس فعال`} />
            <CategoryGrid categories={c.categories} />
          </>
        )}
      </Async>
    </AppScreen>
  );
}
