'use client';
import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

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
        <label>
          نام نمایشی
          <input
            name="displayName"
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); setSaved(false); }}
            autoComplete="nickname"
          />
        </label>
        <label>
          شماره موبایل
          <span style={{ fontSize: 10, color: 'var(--subtle)', fontWeight: 400, marginTop: -2 }}>اختیاری</span>
          <input
            name="phone"
            type="tel"
            value={phone}
            onChange={e => { setPhone(e.target.value); setSaved(false); }}
            autoComplete="tel"
            dir="ltr"
          />
        </label>
      </div>

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
            تغییرات ذخیره شد
          </span>
        )}
        <button className="button primary" type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 size={14} className="spin-icon" />
              در حال ذخیره...
            </>
          ) : (
            'ذخیره تغییرات'
          )}
        </button>
      </div>
    </form>
  );
}
