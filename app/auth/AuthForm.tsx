'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, ArrowRight, Gift, KeyRound, Loader2, Mail, PencilLine, ShieldCheck, Smartphone } from 'lucide-react';
import { Wordmark } from '../../components/zp/brand';
import { CodeBoxes } from '../../components/zp/CodeBoxes';
import { apiErrorMessage } from '../../lib/api-error';
import { normalizeIranMobile, toAsciiDigits } from '../../packages/api-contracts/src/phone';

type Mode = 'login' | 'register';
type Step = 'phone' | 'code' | 'password' | 'mfa';
export type Invite = { code: string; welcomePercent: number };

const faNum = (n: number) => n.toLocaleString('fa-IR');
const clock = (s: number) => `${faNum(Math.floor(s / 60))}:${faNum(s % 60).padStart(2, '۰')}`;
const headers = () => ({ 'Content-Type': 'application/json', Origin: window.location.origin });

/** Official multi-colour Google «G» (brand asset colours, not theme colours). */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function AuthForm({ initialMode = 'login', invite = null, otpEnabled = true, googleEnabled = false, next = '/dashboard', initialError = null }: {
  initialMode?: Mode; invite?: Invite | null; otpEnabled?: boolean; googleEnabled?: boolean; next?: string; initialError?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(otpEnabled ? 'phone' : 'password');
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [phone, setPhone] = useState('');
  const [masked, setMasked] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const verifying = useRef(false);

  // A Google sign-in that needs the second factor comes back with #mfa=<token> (never sent to a server).
  useEffect(() => {
    const m = /#mfa=([A-Za-z0-9_-]{10,200})/.exec(window.location.hash);
    if (!m) return;
    // The hash exists only in the browser, so the switch happens after hydration.
    const t = setTimeout(() => {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setMfaToken(m[1]); setStep('mfa');
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (step !== 'code') return;
    const t = setInterval(() => { setResendIn(s => Math.max(0, s - 1)); setExpiresIn(s => Math.max(0, s - 1)); }, 1000);
    return () => clearInterval(t);
  }, [step]);

  const done = useCallback((res: { mfaRequired?: boolean; challengeToken?: string; next?: string }) => {
    if (res.mfaRequired && res.challengeToken) { setMfaToken(res.challengeToken); setStep('mfa'); setBusy(false); return; }
    router.push(res.next ?? next);
    router.refresh();
  }, [next, router]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const normalized = normalizeIranMobile(phone);
    if (!normalized) { setError('شماره موبایل را درست وارد کنید؛ مثل ۰۹۱۲۳۴۵۶۷۸۹.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/v1/auth/otp/request', { method: 'POST', headers: headers(), body: JSON.stringify({ phone: normalized }) });
      if (!res.ok) {
        const body = await res.clone().json().catch(() => null) as { error?: { details?: { retryAfter?: number } } } | null;
        if (body?.error?.details?.retryAfter && challengeId) setResendIn(body.error.details.retryAfter);
        setError(await apiErrorMessage(res, 'ارسال کد انجام نشد. کمی بعد دوباره تلاش کنید.'));
        return;
      }
      const data = await res.json() as { challengeId: string; resendIn: number; expiresIn: number; maskedPhone: string };
      setChallengeId(data.challengeId); setMasked(data.maskedPhone); setResendIn(data.resendIn); setExpiresIn(data.expiresIn);
      setCode(''); setStep('code');
    } catch { setError('خطا در اتصال به سرور. اتصال اینترنت را بررسی کنید.'); }
    finally { setBusy(false); }
  };

  const verify = useCallback(async (value: string) => {
    if (verifying.current || value.length !== 6) return;
    verifying.current = true; setBusy(true); setError(null);
    try {
      const res = await fetch('/api/v1/auth/otp/verify', { method: 'POST', headers: headers(), body: JSON.stringify({ challengeId, code: value, next, referralCode: invite?.code }) });
      if (!res.ok) {
        const body = await res.clone().json().catch(() => null) as { error?: { details?: { attemptsLeft?: number; locked?: boolean; expired?: boolean } } } | null;
        const d = body?.error?.details;
        let msg = await apiErrorMessage(res, 'کد درست نیست.');
        if (d && typeof d.attemptsLeft === 'number' && d.attemptsLeft > 0) msg += ` ${faNum(d.attemptsLeft)} تلاش دیگر باقی است.`;
        if (d?.locked || d?.expired) { setExpiresIn(0); setResendIn(0); }
        setError(msg); setCode(''); setBusy(false);
        return;
      }
      done(await res.json());
    } catch { setError('خطا در اتصال به سرور. دوباره تلاش کنید.'); setBusy(false); }
    finally { verifying.current = false; }
  }, [challengeId, done, invite, next]);

  // Android Chrome: read the code straight from the SMS (WebOTP; the pattern ends with «@host #code»).
  useEffect(() => {
    if (step !== 'code' || !('OTPCredential' in window)) return;
    const ac = new AbortController();
    (navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal } as CredentialRequestOptions) as Promise<(Credential & { code?: string }) | null>)
      .then(c => { if (c?.code) { setCode(c.code); void verify(c.code); } })
      .catch(() => undefined);
    return () => ac.abort();
  }, [step, verify]);

  const submitPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const data: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => { data[k] = v as string; });
    try {
      const res = await fetch(mode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register', { method: 'POST', headers: headers(), body: JSON.stringify(data) });
      if (!res.ok) {
        setError(await apiErrorMessage(res, mode === 'login' ? 'ایمیل یا رمز عبور اشتباه است.' : 'ثبت‌نام ناموفق بود. لطفاً دوباره تلاش کنید.'));
        setBusy(false); return;
      }
      done(await res.json().catch(() => ({})));
    } catch { setError('خطا در اتصال به سرور. لطفاً دوباره تلاش کنید.'); setBusy(false); }
  };

  const submitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/v1/auth/mfa/challenge', { method: 'POST', headers: headers(), body: JSON.stringify({ challengeToken: mfaToken, code: toAsciiDigits(mfaCode).trim() }) });
      if (!res.ok) { setError(await apiErrorMessage(res, 'کد تأیید دومرحله‌ای درست نیست.')); setBusy(false); return; }
      done({ next });
    } catch { setError('خطا در اتصال به سرور.'); setBusy(false); }
  };

  const go = (s: Step) => { setStep(s); setError(null); setBusy(false); };
  const googleHref = `/api/v1/auth/google/start?client=web&next=${encodeURIComponent(next)}${invite ? `&ref=${invite.code}` : ''}`;

  const heading = {
    phone: { eyebrow: 'ورود یا ثبت‌نام', title: 'به زُحل پی خوش آمدید', text: 'با شماره موبایل وارد شوید؛ اگر حساب ندارید، همین‌جا ساخته می‌شود.' },
    code: { eyebrow: 'تأیید شماره', title: 'کد تأیید را وارد کنید', text: '' },
    password: { eyebrow: mode === 'login' ? 'ورود با ایمیل' : 'ثبت‌نام با ایمیل', title: mode === 'login' ? 'ورود با رمز عبور' : 'ساخت حساب با ایمیل', text: mode === 'login' ? 'با ایمیل و رمز عبور حساب خود وارد شوید.' : 'یک حساب رایگان با ایمیل و رمز عبور بسازید.' },
    mfa: { eyebrow: 'تأیید دومرحله‌ای', title: 'کد اپ احراز هویت', text: 'کد ۶ رقمی اپ احراز هویت (مثل Google Authenticator) را وارد کنید.' },
  }[step];

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-busy={busy}>
        <Link href="/" className="auth-brand zp-root" aria-label="زُحل پی"><Wordmark id="auth-mark" /></Link>

        <span className="eyebrow" style={{ marginTop: 4 }}>{heading.eyebrow}</span>
        <h1 style={{ margin: '6px 0 0' }}>{heading.title}</h1>
        {step === 'code' ? (
          <p>
            کد ۶ رقمی به <bdi dir="ltr" className="zp-ltr-num">{masked}</bdi> پیامک شد.{' '}
            <button type="button" className="auth-inline" onClick={() => { go('phone'); setCode(''); }}>
              <PencilLine size={13} aria-hidden /> ویرایش شماره
            </button>
          </p>
        ) : <p>{heading.text}</p>}

        {error && (
          <div className="auth-error" role="alert"><AlertCircle size={15} /><span>{error}</span></div>
        )}

        {invite && invite.welcomePercent > 0 && step !== 'mfa' && (
          <div className="auth-invite" role="note">
            <Gift size={18} aria-hidden />
            <div>
              <b>دعوت‌نامه‌ی ویژه</b>
              <span>با اولین خرید یا شارژ، {faNum(invite.welcomePercent)}٪ اعتبار هدیه می‌گیرید.</span>
            </div>
          </div>
        )}

        {step === 'phone' && (
          <>
            <form className="auth-form" onSubmit={e => void sendCode(e)} noValidate>
              <label>
                شماره موبایل
                <span className="auth-phone">
                  <Smartphone size={17} aria-hidden />
                  <input
                    name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required autoFocus
                    placeholder="0912 345 6789" value={phone} onChange={e => { setPhone(e.target.value); setError(null); }}
                    aria-describedby="phone-hint"
                  />
                </span>
                <span id="phone-hint" className="auth-hint">کد تأیید یک‌بارمصرف برای این شماره پیامک می‌شود.</span>
              </label>
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? <><Loader2 size={16} className="spin-icon" /> در حال ارسال کد</> : <>دریافت کد تأیید <ArrowLeft size={16} /></>}
              </button>
            </form>
            {googleEnabled && (
              <>
                <div className="auth-or"><span>یا</span></div>
                <a className="auth-google" href={googleHref}><GoogleMark /> ورود با گوگل</a>
              </>
            )}
            <button type="button" className="auth-alt" onClick={() => go('password')}>
              <Mail size={14} aria-hidden /> ورود با ایمیل و رمز عبور
            </button>
          </>
        )}

        {step === 'code' && (
          <form className="auth-form" onSubmit={e => { e.preventDefault(); void verify(code); }} noValidate>
            <CodeBoxes value={code} disabled={busy} invalid={Boolean(error)} onChange={v => { setCode(v); setError(null); if (v.length === 6) void verify(v); }} />
            <div className="auth-timer" aria-live="polite">
              {expiresIn > 0 ? <span>اعتبار کد: <bdi dir="ltr">{clock(expiresIn)}</bdi></span> : <span className="warn">کد منقضی شد؛ کد تازه بگیرید.</span>}
              {resendIn > 0
                ? <span>ارسال دوباره تا <bdi dir="ltr">{clock(resendIn)}</bdi></span>
                : <button type="button" className="auth-inline" disabled={busy} onClick={() => void sendCode()}>ارسال دوباره‌ی کد</button>}
            </div>
            <button className="auth-submit" type="submit" disabled={busy || code.length !== 6}>
              {busy ? <><Loader2 size={16} className="spin-icon" /> در حال بررسی</> : <>تأیید و ورود <ArrowLeft size={16} /></>}
            </button>
          </form>
        )}

        {step === 'password' && (
          <>
            <form className="auth-form" onSubmit={e => void submitPassword(e)} noValidate>
              <input type="hidden" name="next" value={next} />
              {mode === 'register' && invite && <input type="hidden" name="referralCode" value={invite.code} />}
              {mode === 'register' && (
                <label>نام و نام خانوادگی<input name="name" autoComplete="name" required minLength={2} maxLength={120} /></label>
              )}
              <label>آدرس ایمیل<input name="email" type="email" autoComplete="email" required dir="ltr" /></label>
              <label>
                {mode === 'login' ? 'رمز عبور' : 'رمز عبور جدید'}
                <input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 14 : 8} />
                {mode === 'register' && <span className="auth-hint">حداقل ۱۴ کاراکتر — ترکیب حروف بزرگ، کوچک، عدد و نماد.</span>}
              </label>
              {mode === 'register' && !invite && (
                <label>
                  کد دعوت <span style={{ color: 'var(--subtle)', fontWeight: 400 }}>(اختیاری)</span>
                  <input name="referralCode" autoComplete="off" dir="ltr" maxLength={12} style={{ textTransform: 'uppercase', letterSpacing: 2 }} />
                </label>
              )}
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? <><Loader2 size={16} className="spin-icon" /> لطفاً صبر کنید</> : <>{mode === 'login' ? 'ورود' : 'ساخت حساب'} <ArrowLeft size={16} /></>}
              </button>
            </form>
            <div className="auth-divider">
              <span>{mode === 'login' ? 'حساب ایمیلی ندارید؟' : 'حساب دارید؟'}</span>
              <button type="button" className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
                {mode === 'login' ? 'ثبت‌نام با ایمیل' : 'وارد شوید'}
              </button>
            </div>
            {otpEnabled && (
              <button type="button" className="auth-alt" onClick={() => go('phone')}>
                <ArrowRight size={14} aria-hidden /> ورود با شماره موبایل
              </button>
            )}
          </>
        )}

        {step === 'mfa' && (
          <form className="auth-form" onSubmit={e => void submitMfa(e)} noValidate>
            <label>
              کد ۶ رقمی
              <input name="mfa" inputMode="numeric" autoComplete="one-time-code" dir="ltr" required autoFocus maxLength={20}
                value={mfaCode} onChange={e => setMfaCode(e.target.value)} style={{ letterSpacing: 6, textAlign: 'center' }} />
            </label>
            <button className="auth-submit" type="submit" disabled={busy || mfaCode.trim().length < 6}>
              {busy ? <><Loader2 size={16} className="spin-icon" /> در حال بررسی</> : <>تأیید <KeyRound size={16} /></>}
            </button>
          </form>
        )}

        <div className="auth-note">
          <ShieldCheck size={14} />
          <span>اتصال رمزنگاری‌شده · کد و رمز عبور هرگز به‌صورت متن ذخیره نمی‌شوند · با ورود، <Link href="/terms">قوانین زُحل پی</Link> را می‌پذیرید.</span>
        </div>
      </section>
    </main>
  );
}
