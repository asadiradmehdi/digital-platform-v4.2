import Link from 'next/link';
export default function NotFound(){return <main className="error-page"><section className="error-card"><div className="error-code">404</div><h1>این صفحه پیدا نشد</h1><p>آدرس واردشده معتبر نیست یا صفحه جابه‌جا شده است.</p><Link href="/">بازگشت به داشبورد ←</Link></section></main>}
