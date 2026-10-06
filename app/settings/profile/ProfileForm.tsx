'use client';
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  initialDisplayName: string;
  initialPhone: string;
}

export default function ProfileForm({ initialDisplayName, initialPhone }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/v1/me', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        body: JSON.stringify({ displayName, phone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? 'خطا در ذخیره');
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ناشناخته');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-form" onSubmit={e => void handleSave(e)}>
      <div className="form-row">
        <label>نام نمایشی<input name="displayName" value={displayName} onChange={e => { setDisplayName(e.target.value); setSaved(false); }} autoComplete="nickname"/></label>
      </div>
      <label>شماره موبایل<input name="phone" type="tel" value={phone} onChange={e => { setPhone(e.target.value); setSaved(false); }} placeholder="اختیاری" autoComplete="tel" dir="ltr"/></label>
      {error && <p style={{ fontSize: 11, color: 'var(--danger)', margin: 0 }}>{error}</p>}
      <div className="form-actions">
        {saved && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--success)', marginInlineEnd: 'auto' }}><CheckCircle2 size={13}/>ذخیره شد</span>}
        <button className="button primary" type="submit" disabled={saving}>{saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</button>
      </div>
    </form>
  );
}
