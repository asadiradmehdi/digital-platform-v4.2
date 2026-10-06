'use client';
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { setError('رمز عبور جدید و تکرار آن باید یکسان باشند.'); return; }
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/v1/me/password', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
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

  return (
    <form className="settings-form" onSubmit={e => void handleSubmit(e)}>
      <label>رمز عبور فعلی<input name="currentPassword" type="password" autoComplete="current-password" value={current} onChange={e => { setCurrent(e.target.value); setSaved(false); }} required/></label>
      <label>رمز عبور جدید<input name="newPassword" type="password" autoComplete="new-password" value={next} onChange={e => { setNext(e.target.value); setSaved(false); }} required minLength={14}/></label>
      <label>تکرار رمز عبور جدید<input name="confirmPassword" type="password" autoComplete="new-password" value={confirm} onChange={e => { setConfirm(e.target.value); setSaved(false); }} required minLength={14}/></label>
      <p style={{ fontSize: 10, color: 'var(--muted)', margin: 0 }}>حداقل ۱۴ کاراکتر — ترکیب حروف بزرگ، کوچک، عدد و نماد.</p>
      {error && <p style={{ fontSize: 11, color: 'var(--danger)', margin: 0 }}>{error}</p>}
      <div className="form-actions">
        {saved && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--success)', marginInlineEnd: 'auto' }}><CheckCircle2 size={13}/>تغییر رمز عبور موفق بود</span>}
        <button className="button primary" type="submit" disabled={saving}>{saving ? 'در حال ذخیره...' : 'تغییر رمز عبور'}</button>
      </div>
    </form>
  );
}
