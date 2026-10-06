'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';

const CHANNELS = [
  { key: 'email', label: 'ایمیل', desc: 'دریافت اعلان‌های مهم به ایمیل' },
  { key: 'push', label: 'Push notification', desc: 'اعلان فوری در مرورگر یا اپ موبایل' },
  { key: 'sms', label: 'پیامک', desc: 'رویدادهای مهم از جمله ورود و تراکنش' },
];

const CATEGORIES = [
  { key: 'orders', label: 'سفارش‌ها', desc: 'تغییر وضعیت، تکمیل یا لغو سفارش' },
  { key: 'payments', label: 'پرداخت و کیف پول', desc: 'واریز، برداشت، تمدید اشتراک' },
  { key: 'security', label: 'امنیت', desc: 'ورود جدید، تغییر رمز، رویدادهای حساس', alwaysOn: true },
  { key: 'ai', label: 'هوش مصنوعی', desc: 'اتمام اعتبار، خطاهای مدل' },
  { key: 'automation', label: 'اتوماسیون', desc: 'Workflow تکمیل‌شده یا متوقف‌شده' },
  { key: 'updates', label: 'اخبار و به‌روزرسانی', desc: 'قابلیت‌های جدید و تغییرات مهم' },
];

type PrefKey = `${string}:${string}`;

const defaultEnabled = (channel: string, category: string): boolean => {
  if (category === 'security') return true;
  if (channel === 'email' && category !== 'updates') return true;
  return false;
};

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/v1/notifications/preferences', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { preferences?: Array<{ channel: string; category: string; enabled: boolean }> } | null) => {
        if (data?.preferences && data.preferences.length > 0) {
          const map: Record<PrefKey, boolean> = {};
          for (const p of data.preferences) {
            map[`${p.channel}:${p.category}` as PrefKey] = p.enabled;
          }
          setPrefs(map);
        } else {
          const defaults: Record<PrefKey, boolean> = {};
          for (const ch of CHANNELS) {
            for (const cat of CATEGORIES) {
              defaults[`${ch.key}:${cat.key}` as PrefKey] = defaultEnabled(ch.key, cat.key);
            }
          }
          setPrefs(defaults);
        }
        setLoaded(true);
      });
  }, []);

  const toggle = (channel: string, category: string) => {
    const key = `${channel}:${category}` as PrefKey;
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const preferences = Object.entries(prefs).map(([k, enabled]) => {
      const [channel, category] = k.split(':');
      return { channel, category, enabled };
    });
    await fetch('/api/v1/notifications/preferences', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
      body: JSON.stringify({ preferences }),
    });
    setSaving(false);
    setSaved(true);
  };

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div><span className="eyebrow">SETTINGS / NOTIFICATIONS</span><h1>اعلان‌ها</h1><p>کانال‌های اطلاع‌رسانی و دسته‌بندی رویدادهایی که می‌خواهید دریافت کنید.</p></div>
          <Link className="button secondary" href="/settings"><ArrowRight size={15}/>تنظیمات</Link>
        </header>
        <SystemStrip/>
        <div className="settings-layout">
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">CHANNELS</span><h2>کانال‌های اطلاع‌رسانی</h2></div></div>
            <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
              {CHANNELS.map(ch => (
                <label key={ch.key} className="toggle-row">
                  <div>
                    <b style={{ fontSize: 12 }}>{ch.label}</b>
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{ch.desc}</span>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={loaded ? (prefs[`${ch.key}:orders` as PrefKey] ?? defaultEnabled(ch.key, 'orders')) : defaultEnabled(ch.key, 'orders')}
                    onChange={() => {
                      for (const cat of CATEGORIES) {
                        if (!cat.alwaysOn) toggle(ch.key, cat.key);
                      }
                    }}
                    aria-label={ch.label}
                  />
                </label>
              ))}
            </div>
          </article>
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">CATEGORIES</span><h2>دسته‌بندی رویدادها</h2></div></div>
            <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
              {CATEGORIES.map(cat => (
                <label key={cat.key} className="toggle-row">
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 12 }}>{cat.label}</b>
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{cat.desc}</span>
                    {cat.alwaysOn && <span style={{ fontSize: 9, color: 'var(--accent-strong)', display: 'block', marginTop: 3 }}>همیشه فعال — برای امنیت حساب</span>}
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={cat.alwaysOn ? true : (loaded ? (prefs[`email:${cat.key}` as PrefKey] ?? defaultEnabled('email', cat.key)) : defaultEnabled('email', cat.key))}
                    disabled={cat.alwaysOn}
                    onChange={() => { if (!cat.alwaysOn) toggle('email', cat.key); }}
                    aria-label={cat.label}
                  />
                </label>
              ))}
            </div>
            <div className="form-actions" style={{ marginTop: 20 }}>
              {saved && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--success)', marginInlineEnd: 'auto' }}>
                  <CheckCircle2 size={13}/>ذخیره شد
                </span>
              )}
              <button className="button primary" type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
              </button>
            </div>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
