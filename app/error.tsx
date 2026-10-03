'use client';
import { RefreshCw } from 'lucide-react';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="error-page"><section className="error-card"><div className="error-code">خطا</div><h1>یک مشکل موقت پیش آمد</h1><p>اطلاعات شما حفظ می‌شود. می‌توانید دوباره تلاش کنید.</p><button onClick={reset}><RefreshCw size={16}/> تلاش دوباره</button></section></main>; }
