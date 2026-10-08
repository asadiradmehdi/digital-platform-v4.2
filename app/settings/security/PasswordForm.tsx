'use client';
import { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { OtpStep } from '../../../components/zp/OtpStep';

/** Changing (or, for phone/Google accounts, creating) a password needs a fresh SMS code when a phone is verified. */
export default function PasswordForm({ hasPassword = true, phoneVerified = false }: { hasPassword?: boolean; phoneVerified?: boolean }) {
  const [needOtp, setNeedOtp] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const submit = async (otpProof?: string) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/v1/me/password', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        body: JSON.stringify({ currentPassword: hasPassword ? current : undefined, newPassword: next, otpProof }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string; details?: { requiresOtp?: boolean } } };
        if (err.error?.details?.requiresOtp && !otpProof) { setNeedOtp(true); return; }
        throw new Error(err.error?.message ?? 'خطا در تغییر رمز عبور');
      }
      setSaved(true);
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ناشناخته');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { setError('رمز عبور جدید و تکرار آن باید یکسان باشند.'); return; }
    if (next.length < 14) { setError('رمز عبور جدید حداقل ۱۴ کاراکتر باشد.'); return; }
    if (phoneVerified) { setError(null); setNeedOtp(true); return; }
    await submit();
  };

  if (needOtp) {
    return (
      <OtpStep purpose="REAUTH" title="برای تغییر رمز عبور، کد پیامک‌شده را وارد کنید"
        onCancel={() => setNeedOtp(false)} onProof={p => { setNeedOtp(false); void submit(p); }} />
    );
  }

  return (
    <form className="settings-form" onSubmit={e => void handleSubmit(e)}>
      {hasPassword && (
      <label>
        رمز عبور فعلی
        <div style={{ position: 'relative' }}>
          <input
            name="currentPassword"
            type={showCurrent ? 'text' : 'password'}
            autoComplete="current-password"
            value={current}
            onChange={e => { setCurrent(e.target.value); setSaved(false); }}
            required={hasPassword}
            style={{ paddingInlineEnd: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowCurrent(v => !v)}
            aria-label={showCurrent ? 'مخفی کردن' : 'نمایش'}
            style={{
              position: 'absolute',
              insetInlineEnd: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              color: 'var(--subtle)',
              padding: 4,
              display: 'flex',
            }}
          >
            {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </label>
      )}

      <label>
        رمز عبور جدید
        <div style={{ position: 'relative' }}>
          <input
            name="newPassword"
            type={showNext ? 'text' : 'password'}
            autoComplete="new-password"
            value={next}
            onChange={e => { setNext(e.target.value); setSaved(false); }}
            required
            minLength={14}
            style={{ paddingInlineEnd: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowNext(v => !v)}
            aria-label={showNext ? 'مخفی کردن' : 'نمایش'}
            style={{
              position: 'absolute',
              insetInlineEnd: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              color: 'var(--subtle)',
              padding: 4,
              display: 'flex',
            }}
          >
            {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <span style={{ fontSize: 10, color: 'var(--subtle)', lineHeight: 1.7, marginTop: -2 }}>
          حداقل ۱۴ کاراکتر — ترکیب حروف بزرگ، کوچک، عدد و نماد توصیه می‌شود.
        </span>
      </label>

      <label>
        تکرار رمز عبور جدید
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => { setConfirm(e.target.value); setSaved(false); }}
          required
          minLength={14}
        />
      </label>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: 'var(--danger-soft)',
            border: '1px solid rgba(220,38,38,.18)',
            borderRadius: 10,
            fontSize: 12,
            color: 'var(--danger)',
          }}
          role="alert"
        >
          <AlertCircle size={14} style={{ flex: 'none' }} />
          {error}
        </div>
      )}

      <div className="form-actions">
        {saved && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--success)',
              marginInlineEnd: 'auto',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={14} />
            رمز عبور با موفقیت تغییر کرد
          </span>
        )}
        <button className="button primary" type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 size={14} className="spin-icon" />
              در حال ذخیره...
            </>
          ) : (
            hasPassword ? 'تغییر رمز عبور' : 'ساخت رمز عبور'
          )}
        </button>
      </div>
    </form>
  );
}
