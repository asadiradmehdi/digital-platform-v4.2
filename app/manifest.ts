import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'زُحل پی | ZOHALPAY',
    short_name: 'زُحل پی',
    description: 'خرید فالوور، ممبر، بازدید و اشتراک هوش مصنوعی با قیمت شفاف و پیگیری لحظه‌ای سفارش',
    start_url: '/',
    display: 'standalone',
    lang: 'fa',
    dir: 'rtl',
    background_color: '#F7F3EA',
    theme_color: '#F7F3EA',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/brand/zohalpay-logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
