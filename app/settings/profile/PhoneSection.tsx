'use client';
// Verified mobile number: add or change it only by proving possession with an SMS code. When a number is
// already verified, a fresh code to that number is required first.
import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert, Smartphone } from 'lucide-react';
import { OtpStep } from '../../../components/zp/OtpStep';
import { apiErrorMessage } from '../../../lib/api-error';
import { formatIranMobile, normalizeIranMobile } from '../../../packages/api-contracts/src/phone';

type Step = 'view' | 'enter' | 'reauth' | 'verify' | 'saving';

export default function PhoneSection({ phone, verified }: { phone: string | null; verified: boolean }) {
  const [current, setCurrent] = useState(phone);
  const [isVerified, setVerified] = useState(verified);
  const [step, setStep] = useState<Step>('view');
  const [input, setInput] = useState('');
  const [target, setTarget] = useState('');
  const [reauthProof, setReauthProof] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    const n = normalizeIranMobile(input);
    if (!n) { setError('شماره موبایل را درست وارد کنید؛ مثل ۰۹۱۲۳۴۵۶۷۸۹.'); return; }
    setError(null); setTarget(n);
    setStep(current && isVerified ? 'reauth' : 'verify');
  };

  const save = async (proof: string) => {
    setStep('saving');
    try {
      const res = await fetch('/api/v1/me/phone', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
        body: JSON.stringify({ proof, reauthProof }),
      });
      if (!res.ok) { setError(await apiErrorMessage(res, 'ثبت شماره انجام نشد.')); setStep('enter'); return; }
      setCurrent(target); setVerified(true); setSaved(true); setStep('view'); setInput(''); setReauthProof(null);
    } catch { setError('خطا در اتصال به سرور.'); setStep('enter'); }
  };

  return (
    <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>شماره موبایل</span>
      <div className="zp-phone-row">
        <Smartphone size={17} style={{ color: 'var(--subtle)' }} aria-hidden />
        <span className="grow">{current ? <span className="num">{formatIranMobile(current)}</span> : <span style={{ fontSize: 12, color: 'var(--muted)' }}>ثبت نشده</span>}</span>
        {current && (isVerified
          ? <span className="status-pill success" style={{ fontSize: 11 }}><CheckCircle2 size={11} /> تأییدشده</span>
          : <span className="status-pill warning" style={{ fontSize: 11 }}><ShieldAlert size={11} /> تأییدنشده</span>)}
        {step === 'view' && (
          <button type="button" className="button secondary" style={{ height: 34, fontSize: 12 }} onClick={() => { setStep('enter'); setSaved(false); setError(null); }}>
            {current && isVerified ? 'تغییر شماره' : 'تأیید شماره'}
          </button>
        )}
      </div>
      {saved && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--success)', fontWeight: 600 }}><CheckCircle2 size={14} /> شماره تأیید و ذخیره شد.</span>}
      {step === 'view' && current && !isVerified && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>تا تأیید نشود، ورود با پیامک و پیامک‌های سفارش برای این شماره فعال نیست.</p>
      )}

      {step === 'enter' && (
        <form className="settings-form" onSubmit={start} noValidate style={{ gap: 10 }}>
          <label>
            {current && isVerified ? 'شماره‌ی جدید' : 'شماره موبایل'}
            <input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" autoFocus value={input} placeholder="0912 345 6789"
              onChange={e => { setInput(e.target.value); setError(null); }} style={{ fontFamily: 'var(--font-latin)', textAlign: 'left' }} />
          </label>
          {error && <div className="auth-error" role="alert" style={{ marginTop: 0 }}><AlertCircle size={14} /><span>{error}</span></div>}
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => { setStep('view'); setError(null); }}>انصراف</button>
            <button type="submit" className="button primary">ارسال کد تأیید</button>
          </div>
        </form>
      )}

      {step === 'reauth' && (
        <OtpStep purpose="REAUTH" title="اول، تأیید با شماره‌ی فعلی" onCancel={() => setStep('view')}
          onProof={p => { setReauthProof(p); setStep('verify'); }} />
      )}
      {step === 'verify' && (
        <OtpStep purpose="PHONE_CHANGE" phone={target} title="تأیید شماره‌ی جدید" onCancel={() => setStep('view')} onProof={p => void save(p)} />
      )}
      {step === 'saving' && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}><Loader2 size={14} className="spin-icon" /> در حال ذخیره…</span>}
    </div>
  );
}
