'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, Info, ShoppingBag, Zap, AlertCircle } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';

const serviceRegistry: Record<string, {
  id: string; title: string; description: string; category: string;
  priceMinor: number; unitLabel: string; unitDivisor: number;
  fields: Array<{ id: string; label: string; placeholder: string; type: 'text' | 'number' | 'url'; hint?: string }>;
  quantities?: number[];
}> = {
  'ig-followers': {
    id: 'ig-followers', title: 'فالوور اینستاگرام', description: 'افزایش فالوور واقعی با مسیردهی هوشمند تأمین‌کننده.',
    category: 'اینستاگرام', priceMinor: 1_200_000, unitLabel: 'فالوور', unitDivisor: 1000,
    fields: [{ id: 'target', label: 'نام کاربری اینستاگرام', placeholder: '@username', type: 'text', hint: 'پروفایل باید عمومی (Public) باشد.' }],
    quantities: [500, 1000, 2000, 5000],
  },
  'ig-likes': {
    id: 'ig-likes', title: 'لایک اینستاگرام', description: 'لایک ارگانیک با تحویل سریع.',
    category: 'اینستاگرام', priceMinor: 350_000, unitLabel: 'لایک', unitDivisor: 1000,
    fields: [{ id: 'target', label: 'لینک پست', placeholder: 'https://instagram.com/p/...', type: 'url', hint: 'لینک مستقیم پست اینستاگرام.' }],
    quantities: [500, 1000, 2000, 5000],
  },
  'ig-views': {
    id: 'ig-views', title: 'ویو Reel اینستاگرام', description: 'افزایش بازدید Reel با ماندگاری بالا.',
    category: 'اینستاگرام', priceMinor: 180_000, unitLabel: 'ویو', unitDivisor: 1000,
    fields: [{ id: 'target', label: 'لینک Reel', placeholder: 'https://instagram.com/reel/...', type: 'url' }],
    quantities: [1000, 5000, 10000, 50000],
  },
  'ig-comments': {
    id: 'ig-comments', title: 'کامنت اینستاگرام', description: 'کامنت‌های سفارشی فارسی و انگلیسی.',
    category: 'اینستاگرام', priceMinor: 850_000, unitLabel: 'کامنت', unitDivisor: 100,
    fields: [
      { id: 'target', label: 'لینک پست', placeholder: 'https://instagram.com/p/...', type: 'url' },
      { id: 'comment_text', label: 'متن کامنت‌ها (اختیاری)', placeholder: 'کامنت‌های دلخواه را وارد کنید...', type: 'text', hint: 'اگر خالی باشد از متون تولیدشده توسط AI استفاده می‌شود.' },
    ],
    quantities: [100, 200, 500],
  },
  'ai-writer': {
    id: 'ai-writer', title: 'AI Writer Pro', description: 'تولید محتوای فارسی و انگلیسی با مدل‌های پیشرفته.',
    category: 'هوش مصنوعی', priceMinor: 6_600_000, unitLabel: 'ماهانه', unitDivisor: 1,
    fields: [{ id: 'workspace', label: 'فضای کاری', placeholder: 'Workspace اصلی', type: 'text' }],
  },
  'ai-image': {
    id: 'ai-image', title: 'AI Image Studio', description: 'تولید تصویر حرفه‌ای با هوش مصنوعی.',
    category: 'هوش مصنوعی', priceMinor: 4_200_000, unitLabel: 'ماهانه', unitDivisor: 1,
    fields: [{ id: 'workspace', label: 'فضای کاری', placeholder: 'Workspace اصلی', type: 'text' }],
  },
  'automation-pro': {
    id: 'automation-pro', title: 'Automation Pro', description: 'فرآیندهای خودکار با webhook و Agent.',
    category: 'اتوماسیون', priceMinor: 8_900_000, unitLabel: 'ماهانه', unitDivisor: 1,
    fields: [{ id: 'workspace', label: 'فضای کاری', placeholder: 'Workspace اصلی', type: 'text' }],
  },
  'tg-members': {
    id: 'tg-members', title: 'ممبر تلگرام', description: 'افزایش ممبر کانال و گروه تلگرام.',
    category: 'تلگرام', priceMinor: 980_000, unitLabel: 'ممبر', unitDivisor: 1000,
    fields: [{ id: 'target', label: 'لینک کانال یا گروه', placeholder: 'https://t.me/channelname', type: 'url', hint: 'کانال یا گروه باید عمومی باشد.' }],
    quantities: [500, 1000, 2000, 5000],
  },
  'tg-views': {
    id: 'tg-views', title: 'ویو تلگرام', description: 'افزایش بازدید پست‌های تلگرام.',
    category: 'تلگرام', priceMinor: 120_000, unitLabel: 'ویو', unitDivisor: 1000,
    fields: [{ id: 'target', label: 'لینک پست', placeholder: 'https://t.me/channelname/123', type: 'url' }],
    quantities: [1000, 5000, 10000, 50000],
  },
  'tt-followers': {
    id: 'tt-followers', title: 'فالوور تیک‌تاک', description: 'رشد فالوور تیک‌تاک با تأمین‌کننده جهانی.',
    category: 'تیک‌تاک', priceMinor: 1_450_000, unitLabel: 'فالوور', unitDivisor: 1000,
    fields: [{ id: 'target', label: 'نام کاربری تیک‌تاک', placeholder: '@username', type: 'text', hint: 'پروفایل باید عمومی باشد.' }],
    quantities: [500, 1000, 2000, 5000],
  },
  'yt-subscribers': {
    id: 'yt-subscribers', title: 'ساب‌سکرایبر یوتیوب', description: 'افزایش ساب‌سکرایبر با رعایت سیاست‌های پلتفرم.',
    category: 'یوتیوب', priceMinor: 2_800_000, unitLabel: 'ساب‌سکرایبر', unitDivisor: 1000,
    fields: [{ id: 'target', label: 'لینک کانال یوتیوب', placeholder: 'https://youtube.com/@channel', type: 'url' }],
    quantities: [500, 1000, 2000, 5000],
  },
  'growth-pack': {
    id: 'growth-pack', title: 'پکیج رشد شبکه‌های اجتماعی', description: 'ترکیب فالوور، لایک و ویو با تخفیف پکیجی.',
    category: 'اینستاگرام', priceMinor: 5_400_000, unitLabel: 'پکیج ماهانه', unitDivisor: 1,
    fields: [{ id: 'target', label: 'نام کاربری اینستاگرام', placeholder: '@username', type: 'text' }],
  },
};

function formatPrice(minor: number) {
  return new Intl.NumberFormat('fa-IR').format(Math.round(minor / 10)) + ' تومان';
}

function OrderNewForm() {
  const params = useSearchParams();
  const router = useRouter();
  const serviceSlug = params.get('service') ?? '';
  const service = serviceRegistry[serviceSlug];

  const [qty, setQty] = useState<number>(service?.quantities?.[1] ?? 1);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/wallet', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { items?: Array<{ balanceMinor: string; currency: string }> } | null) => {
        const item = data?.items?.[0];
        if (item) {
          const toman = Math.round(Number(item.balanceMinor) / 10);
          setWalletBalance(new Intl.NumberFormat('fa-IR').format(toman) + ' تومان');
        }
      })
      .catch(() => {});
  }, []);

  if (!service) {
    return (
      <main className="workspace-page-content">
        <div className="state-block state-empty" style={{ marginTop: 40 }}>
          <ShoppingBag size={28} />
          <h3>سرویس انتخاب نشده</h3>
          <p>لطفاً از کاتالوگ خدمات، سرویس موردنظر را انتخاب کنید.</p>
          <Link href="/services" className="button primary" style={{ marginTop: 14, textDecoration: 'none' }}>
            مشاهده خدمات
          </Link>
        </div>
      </main>
    );
  }

  const unitQty = service.quantities ? qty : 1;
  const unitsLabel = service.quantities
    ? `${new Intl.NumberFormat('fa-IR').format(unitQty)} ${service.unitLabel}`
    : service.unitLabel;
  const totalMinor = service.quantities
    ? Math.round((unitQty / service.unitDivisor) * service.priceMinor)
    : service.priceMinor;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Resolve workspace ID
      const wsRes = await fetch('/api/v1/workspaces');
      if (!wsRes.ok) throw new Error('لطفاً ابتدا وارد حساب کاربری شوید.');
      const wsData = await wsRes.json() as { items: Array<{ id: string }> };
      const workspaceId = wsData.items[0]?.id;
      if (!workspaceId) throw new Error('فضای کاری یافت نشد. ابتدا یک workspace ایجاد کنید.');

      // Resolve real service UUID by slug
      const svcRes = await fetch(`/api/v1/services?slug=${encodeURIComponent(serviceSlug)}`);
      if (!svcRes.ok) throw new Error('سرویس مورد نظر در سیستم یافت نشد.');
      const svcData = await svcRes.json() as { item?: { id: string } };
      const serviceId = svcData.item?.id;
      if (!serviceId) throw new Error('سرویس مورد نظر در سیستم یافت نشد.');

      // Submit order
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const orderRes = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ workspaceId, serviceId, quantity: unitQty, parameters: fields }),
      });
      if (!orderRes.ok) {
        const errData = await orderRes.json() as { error?: { message?: string } };
        throw new Error(errData.error?.message ?? 'خطا در ثبت سفارش. لطفاً دوباره تلاش کنید.');
      }
      setSubmitted(true);
      setTimeout(() => router.push('/orders'), 2000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'خطا در ثبت سفارش.');
    } finally {
      setSubmitting(false);
    }
  }, [serviceSlug, unitQty, fields, router]);

  if (submitted) {
    return (
      <main className="workspace-page-content">
        <div className="state-block state-success" style={{ marginTop: 40 }}>
          <Zap size={28} />
          <h3>سفارش ثبت شد</h3>
          <p>سفارش شما در صف پردازش قرار گرفت. پس از تأیید پرداخت، اجرا آغاز می‌شود.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Link href="/orders" className="button primary" style={{ textDecoration: 'none' }}>مشاهده سفارش‌ها</Link>
            <Link href="/services" className="button secondary" style={{ textDecoration: 'none' }}>سرویس جدید</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="workspace-page-content">
      <header className="page-header" style={{ marginBottom: 22 }}>
        <div>
          <Link href="/services" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 11, textDecoration: 'none', marginBottom: 8 }}>
            <ArrowRight size={13} />خدمات
          </Link>
          <span className="eyebrow">{service.category} · سفارش جدید</span>
          <h1 style={{ marginTop: 4 }}>{service.title}</h1>
          <p>{service.description}</p>
        </div>
      </header>

      <form className="order-new-layout" onSubmit={handleSubmit}>
        {/* Config panel */}
        <article className="surface-panel">
          <div className="panel-head" style={{ marginBottom: 18 }}>
            <div>
              <p className="panel-kicker">CONFIGURATION</p>
              <h2>پیکربندی سفارش</h2>
            </div>
          </div>

          {service.quantities && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>مقدار</label>
              <div className="qty-grid">
                {service.quantities.map(q => (
                  <button
                    key={q}
                    type="button"
                    className={`qty-btn${qty === q ? ' active' : ''}`}
                    onClick={() => setQty(q)}
                  >
                    {new Intl.NumberFormat('fa-IR').format(q)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="settings-form" style={{ gap: 16 }}>
            {service.fields.map(f => (
              <label key={f.id}>
                {f.label}
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={fields[f.id] ?? ''}
                  onChange={e => setFields(prev => ({ ...prev, [f.id]: e.target.value }))}
                  required={f.id === 'target'}
                  dir={f.type === 'url' ? 'ltr' : undefined}
                />
                {f.hint && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 9, marginTop: 5 }}>
                    <Info size={11} />{f.hint}
                  </span>
                )}
              </label>
            ))}
          </div>
        </article>

        {/* Summary panel */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <article className="surface-panel">
            <div className="panel-head" style={{ marginBottom: 14 }}>
              <div>
                <p className="panel-kicker">SUMMARY</p>
                <h2>خلاصه سفارش</h2>
              </div>
            </div>
            <div className="order-meta-list">
              <div className="order-meta-row">
                <span>سرویس</span>
                <strong>{service.title}</strong>
              </div>
              <div className="order-meta-row">
                <span>مقدار</span>
                <strong>{unitsLabel}</strong>
              </div>
              <div className="order-meta-row" style={{ background: 'var(--accent-soft)', borderColor: 'rgba(155,124,255,.2)' }}>
                <span style={{ color: 'var(--accent-strong)', fontWeight: 700 }}>مبلغ نهایی</span>
                <strong style={{ fontSize: 16 }}>{formatPrice(totalMinor)}</strong>
              </div>
            </div>
          </article>

          <article className="surface-panel">
            <div className="panel-head" style={{ marginBottom: 14 }}>
              <div>
                <p className="panel-kicker">PAYMENT</p>
                <h2>پرداخت</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span>موجودی کیف پول</span>
                <span style={{ color: 'var(--success)' }}>{walletBalance ?? '...'}</span>
              </div>
              {submitError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px', background: 'rgba(255,113,135,.08)', border: '1px solid rgba(255,113,135,.2)', borderRadius: 10, fontSize: 11, color: 'var(--danger)' }}>
                  <AlertCircle size={14}/>{submitError}
                </div>
              )}
              <button type="submit" className="button primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={submitting}>
                <Zap size={14} />{submitting ? 'در حال ثبت...' : 'ثبت و پرداخت سفارش'}
              </button>
              <Link href="/services" className="button secondary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                <ChevronLeft size={14} />بازگشت
              </Link>
            </div>
          </article>
        </aside>
      </form>
    </main>
  );
}

export default function OrderNewPage() {
  return (
    <AppShell>
      <Suspense fallback={
        <main className="workspace-page-content">
          <div className="state-block state-loading" style={{ marginTop: 40 }}>
            <div className="skeleton skeleton-panel" style={{ width: '100%' }} />
          </div>
        </main>
      }>
        <OrderNewForm />
      </Suspense>
    </AppShell>
  );
}
