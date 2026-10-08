'use client';
// Inline "fresh SMS code" step for sensitive changes (phone, email, password). Sends the code on mount,
// shows six boxes with a countdown and resend, and hands the server's single-use proof to the caller.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { CodeBoxes } from './CodeBoxes';
import { apiErrorMessage } from '../../lib/api-error';

const faNum = (n: number) => n.toLocaleString('fa-IR');
const headers = () => ({ 'Content-Type': 'application/json', Origin: window.location.origin });

export function OtpStep({ purpose, phone, title, onProof, onCancel }: {
  purpose: 'REAUTH' | 'PHONE_CHANGE'; phone?: string; title: string; onProof: (proof: string) => void; onCancel: () => void;
}) {
  const [status, setStatus] = useState<'sending' | 'ready' | 'verifying' | 'error'>('sending');
  const [error, setError] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState('');
  const [masked, setMasked] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const started = useRef(false);

  const send = useCallback(async () => {
    setStatus('sending'); setError(null);
    try {
      const res = await fetch('/api/v1/me/otp/request', { method: 'POST', credentials: 'same-origin', headers: headers(), body: JSON.stringify({ purpose, phone }) });
      if (!res.ok) { setError(await apiErrorMessage(res, 'ارسال کد انجام نشد.')); setStatus('error'); return; }
      const d = await res.json() as { challengeId: string; maskedPhone: string; resendIn: number };
      setChallengeId(d.challengeId); setMasked(d.maskedPhone); setResendIn(d.resendIn); setCode(''); setStatus('ready');
    } catch { setError('خطا در اتصال به سرور.'); setStatus('error'); }
  }, [phone, purpose]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = setTimeout(() => { void send(); }, 0);
    return () => clearTimeout(t);
  }, [send]);

  useEffect(() => {
    if (status !== 'ready' || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [status, resendIn]);

  const verify = async (value: string) => {
    if (value.length !== 6 || status === 'verifying') return;
    setStatus('verifying'); setError(null);
    try {
      const res = await fetch('/api/v1/me/otp/verify', { method: 'POST', credentials: 'same-origin', headers: headers(), body: JSON.stringify({ purpose, challengeId, code: value }) });
      if (!res.ok) { setError(await apiErrorMessage(res, 'کد درست نیست.')); setCode(''); setStatus('ready'); return; }
      onProof((await res.json() as { proof: string }).proof);
    } catch { setError('خطا در اتصال به سرور.'); setStatus('ready'); }
  };

  return (
    <div className="zp-otpstep" role="group" aria-label={title}>
      <b>{title}</b>
      {status === 'sending' ? (
        <span className="muted" aria-live="polite"><Loader2 size={14} className="spin-icon" /> در حال ارسال کد…</span>
      ) : masked ? (
        <span className="muted">کد ۶ رقمی به <bdi dir="ltr" className="zp-ltr-num">{masked}</bdi> پیامک شد.</span>
      ) : null}
      {status !== 'sending' && challengeId && (
        <div className="auth-form" style={{ marginTop: 4 }}>
          <CodeBoxes value={code} disabled={status === 'verifying'} invalid={Boolean(error)} onChange={v => { setCode(v); setError(null); if (v.length === 6) void verify(v); }} />
        </div>
      )}
      {error && <div className="auth-error" role="alert" style={{ marginTop: 0 }}><AlertCircle size={14} /><span>{error}</span></div>}
      <div className="row">
        {status === 'verifying' ? <span className="muted"><Loader2 size={14} className="spin-icon" /> در حال بررسی…</span>
          : resendIn > 0 ? <span className="muted">ارسال دوباره تا <bdi dir="ltr">{faNum(resendIn)}</bdi> ثانیه</span>
            : <button type="button" className="auth-inline" onClick={() => void send()}>ارسال دوباره‌ی کد</button>}
        <button type="button" className="auth-inline" onClick={onCancel} style={{ color: 'var(--muted)' }}>انصراف</button>
      </div>
    </div>
  );
}
