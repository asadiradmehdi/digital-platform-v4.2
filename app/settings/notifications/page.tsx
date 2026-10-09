'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Bell, CheckCircle2, Loader2, Lock, MessageSquareText } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';

const CHANNELS = [
  { key: 'email', label: 'ایمیل', desc: 'دریافت اعلان‌های مهم به ایمیل' },
  { key: 'push', label: 'اعلان فوری', desc: 'اعلان فوری در مرورگر یا اپ موبایل' },
] as const;

const CATEGORIES: Array<{ key: string; label: string; desc: string; alwaysOn?: boolean }> = [
  { key: 'orders', label: 'سفارش‌ها', desc: 'تغییر وضعیت، تکمیل یا لغو سفارش' },
  { key: 'payments', label: 'پرداخت و کیف پول', desc: 'واریز، برداشت، تمدید اشتراک' },
  { key: 'security', label: 'امنیت', desc: 'ورود جدید، تغییر رمز، رویدادهای حساس', alwaysOn: true },
  { key: 'ai', label: 'هوش مصنوعی', desc: 'اتمام اعتبار، خطاهای مدل' },
  { key: 'automation', label: 'اتوماسیون', desc: 'فرآیند تکمیل‌شده یا متوقف‌شده' },
  { key: 'updates', label: 'اخبار و به‌روزرسانی', desc: 'قابلیت‌های جدید و تغییرات مهم' },
];

type PrefKey = `${string}:${string}`;

// SMS policy: sign-in codes and payment receipts always; order registered/completed can be switched off;
// everything else is in-app only (the bell).
const SMS_ROWS: Array<{ key: string; label: string; desc: string; alwaysOn?: boolean }> = [
  { key: 'security', label: 'کد ورود و تأیید', desc: 'کد یک‌بارمصرف ورود و تأیید تغییرات حساس', alwaysOn: true },
  { key: 'payments', label: 'رسید پرداخت', desc: 'مبلغ و کد پیگیری هر پرداخت موفق', alwaysOn: true },
  { key: 'orders', label: 'ثبت و تکمیل سفارش', desc: 'کد پیگیری ZP و لینک کوتاه وضعیت سفارش' },
];

const defaultEnabled = (channel: string, category: string): boolean => {
  if (category === 'security') return true;
  if (channel === 'sms') return category === 'orders' || category === 'payments';
  if (channel === 'email' && category !== 'updates') return true;
  return false;
};

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    fetch('/api/v1/notifications/preferences', { credentials: 'same-origin' })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
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
      })
      .catch(() => setLoadError(true));
  }, []);

  const toggle = (channel: string, category: string) => {
    const key = `${channel}:${category}` as PrefKey;
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    const preferences = Object.entries(prefs).map(([k, enabled]) => {
      const [channel, category] = k.split(':');
      return { channel, category, enabled };
    });
    try {
      const res = await fetch('/api/v1/notifications/preferences', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        body: JSON.stringify({ preferences }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaved(true);
    } catch { setSaveError(true); } finally { setSaving(false); }
  };

  const smsOrders = prefs['sms:orders' as PrefKey] ?? defaultEnabled('sms', 'orders');

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div>
            <span className="eyebrow">حساب کاربری · اعلان‌ها</span>
            <h1>اعلان‌ها</h1>
            <p>کانال‌های اطلاع‌رسانی و دسته‌بندی رویدادهایی که می‌خواهید دریافت کنید.</p>
          </div>
          <Link className="button secondary" href="/settings">
            <ArrowRight size={15} />
            تنظیمات
          </Link>
        </header>

        <div className="settings-layout">
          {/* Channels */}
          <article className="surface-panel" style={{ padding: 28 }}>
            <div className="panel-head">
              <div>
                <h2>کانال‌های اطلاع‌رسانی</h2>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, margin: '0 0 20px' }}>
              روش‌های ارسال اعلان را انتخاب کنید. غیرفعال کردن یک کانال، همه دسته‌های آن را متوقف می‌کند.
            </p>
            <div style={{ display: 'grid', gap: 2 }}>
              {CHANNELS.map(ch => {
                const isOn = loaded
                  ? (prefs[`${ch.key}:orders` as PrefKey] ?? defaultEnabled(ch.key, 'orders'))
                  : defaultEnabled(ch.key, 'orders');
                return (
                  <label key={ch.key} className="toggle-row">
                    <Bell size={15} style={{ color: 'var(--subtle)', flex: 'none' }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{ch.label}</strong>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {ch.desc}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={isOn}
                      onChange={() => {
                        for (const cat of CATEGORIES) {
                          if (!cat.alwaysOn) toggle(ch.key, cat.key);
                        }
                      }}
                      aria-label={ch.label}
                    />
                  </label>
                );
              })}
            </div>
          </article>

          {loadError && (
            <div className="auth-error" role="alert" style={{ marginTop: 0 }}>
              <AlertCircle size={15} />
              <span>تنظیمات اعلان‌ها دریافت نشد. صفحه را دوباره باز کنید.</span>
            </div>
          )}

          {/* SMS */}
          <article className="surface-panel" style={{ padding: 28 }}>
            <div className="panel-head">
              <div>
                <h2>پیامک</h2>
              </div>
              <MessageSquareText size={18} style={{ color: 'var(--subtle)' }} aria-hidden />
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, margin: '0 0 20px' }}>
              پیامک فقط برای موارد مهم و فقط به شماره‌ی تأییدشده‌ی شما ارسال می‌شود. بقیه‌ی رویدادها (شروع سفارش، پاسخ تیکت و …) در اعلان‌های داخل برنامه نمایش داده می‌شوند.
            </p>
            <div style={{ display: 'grid', gap: 2 }}>
              {SMS_ROWS.map(row => (
                <label key={row.key} className="toggle-row" style={row.alwaysOn ? { cursor: 'default' } : undefined}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{row.label}</strong>
                      {row.alwaysOn && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent-strong)', fontWeight: 700 }}>
                          <Lock size={9} />
                          همیشه فعال
                        </span>
                      )}
                    </div>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{row.desc}</span>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={row.alwaysOn ? true : smsOrders}
                    disabled={row.alwaysOn || !loaded}
                    onChange={() => { if (!row.alwaysOn) toggle('sms', row.key); }}
                    aria-label={`پیامک: ${row.label}`}
                  />
                </label>
              ))}
            </div>
          </article>

          {/* Categories */}
          <article className="surface-panel" style={{ padding: 28 }}>
            <div className="panel-head">
              <div>
                <h2>دسته‌بندی رویدادها</h2>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, margin: '0 0 20px' }}>
              انواع رویدادهایی که می‌خواهید برای آن‌ها اعلان دریافت کنید.
            </p>
            <div style={{ display: 'grid', gap: 2 }}>
              {CATEGORIES.map(cat => (
                <label
                  key={cat.key}
                  className="toggle-row"
                  style={cat.alwaysOn ? { cursor: 'default' } : undefined}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{cat.label}</strong>
                      {cat.alwaysOn && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            color: 'var(--accent-strong)',
                            fontWeight: 700,
                            letterSpacing: '.04em',
                          }}
                        >
                          <Lock size={9} />
                          همیشه فعال
                        </span>
                      )}
                    </div>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {cat.desc}
                    </span>
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

            <div className="form-actions" style={{ marginTop: 24 }}>
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
                  تنظیمات ذخیره شد
                </span>
              )}
              {saveError && (
                <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--danger)', marginInlineEnd: 'auto', fontWeight: 600 }}>
                  <AlertCircle size={14} />
                  ذخیره انجام نشد؛ دوباره تلاش کنید.
                </span>
              )}
              <button className="button primary" type="button" onClick={handleSave} disabled={saving || !loaded}>
                {saving ? (
                  <>
                    <Loader2 size={14} className="spin-icon" />
                    در حال ذخیره...
                  </>
                ) : (
                  'ذخیره تنظیمات'
                )}
              </button>
            </div>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
