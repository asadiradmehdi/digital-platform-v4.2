'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';

type Mode = 'login' | 'register';
type Status = 'idle' | 'loading' | 'error';

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    const form = e.currentTarget;
    const data: Record<string, string> = {};
    new FormData(form).forEach((v, k) => { data[k] = v as string; });
    const endpoint = mode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(
          body?.error?.message ??
          (mode === 'login'
            ? 'ایمیل یا رمز عبور اشتباه است.'
            : 'ثبت‌نام ناموفق بود. لطفاً دوباره تلاش کنید.'),
        );
        setStatus('error');
      }
    } catch {
      setErrorMsg('خطا در اتصال به سرور. لطفاً دوباره تلاش کنید.');
      setStatus('error');
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        {/* Brand */}
        <Link href="/" className="auth-brand">
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'var(--accent)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 16,
              fontWeight: 900,
              flex: 'none',
            }}
            aria-hidden="true"
          >
            ✦
          </span>
          <span>
            <b>پلتفرم</b>
            <small>خدمات دیجیتال</small>
          </span>
        </Link>

        {/* Heading */}
        <span className="eyebrow" style={{ marginTop: 4 }}>
          {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </span>
        <h1 style={{ margin: '6px 0 0' }}>
          {mode === 'login' ? 'ورود به Workspace' : 'ساخت حساب جدید'}
        </h1>
        <p>
          {mode === 'login'
            ? 'برای دسترسی به داشبورد، سفارش‌ها، کیف پول و پروژه‌های AI وارد شوید.'
            : 'حساب رایگان بسازید و پلتفرم را کشف کنید.'}
        </p>

        {/* Error */}
        {status === 'error' && (
          <div className="auth-error" role="alert">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {mode === 'register' && (
            <label>
              نام
              <input
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="نام شما"
              />
            </label>
          )}

          <label>
            ایمیل
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="your@email.com"
              dir="ltr"
            />
          </label>

          <label>
            رمز عبور
            <input
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 14 : 8}
              placeholder={mode === 'register' ? 'حداقل ۱۴ کاراکتر' : '••••••••'}
            />
          </label>

          {mode === 'login' && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Link
                href="/auth/forgot"
                style={{
                  fontSize: 11,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                فراموشی رمز عبور
              </Link>
            </div>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={status === 'loading'}
            style={{ marginTop: 4 }}
          >
            {status === 'loading' ? (
              <>
                <Loader2 size={16} className="spin-icon" />
                لطفاً صبر کنید
              </>
            ) : mode === 'login' ? (
              <>
                ورود
                <ArrowLeft size={16} />
              </>
            ) : (
              <>
                ساخت حساب
                <ArrowLeft size={16} />
              </>
            )}
          </button>
        </form>

        {/* Mode switch */}
        <div className="auth-divider">
          {mode === 'login' ? (
            <>
              <span>حساب ندارید؟</span>
              <button
                type="button"
                className="auth-switch"
                onClick={() => { setMode('register'); setStatus('idle'); setErrorMsg(''); }}
              >
                ثبت‌نام کنید
              </button>
            </>
          ) : (
            <>
              <span>قبلاً ثبت‌نام کرده‌اید؟</span>
              <button
                type="button"
                className="auth-switch"
                onClick={() => { setMode('login'); setStatus('idle'); setErrorMsg(''); }}
              >
                وارد شوید
              </button>
            </>
          )}
        </div>

        {/* Trust note */}
        <div className="auth-note">
          <ShieldCheck size={14} />
          <span>
            اتصال رمزنگاری‌شده · رمز عبور متن‌خوانی ذخیره نمی‌شود · احراز هویت دومرحله‌ای پشتیبانی
            می‌شود.
          </span>
        </div>
      </section>
    </main>
  );
}
