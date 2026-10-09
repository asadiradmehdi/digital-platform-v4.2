/** Installable manifest for the admin console: its own home-screen icon and standalone window, scoped to /admin. */
export function GET() {
  return Response.json({
    name: 'مدیریت زُحل پی',
    short_name: 'مدیریت',
    description: 'پنل مدیریت زُحل پی: سفارش‌ها، کاربران، قیمت‌ها و تنظیمات',
    id: '/admin/',
    start_url: '/admin/dashboard',
    scope: '/admin/',
    display: 'standalone',
    lang: 'fa',
    dir: 'rtl',
    background_color: '#142257',
    theme_color: '#142257',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/brand/zohalpay-logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }, { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
