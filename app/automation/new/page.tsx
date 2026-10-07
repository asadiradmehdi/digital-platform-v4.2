'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, ArrowRight, CheckCircle2, ChevronLeft,
  GitBranch, Globe, Mail, MessageSquare, Plus, Timer, Trash2, Webhook, Zap,
} from 'lucide-react';
import { AppShell } from '../../../components/AppShell';

const triggerTypes = [
  { id: 'webhook', icon: Webhook, label: 'Webhook', desc: 'درخواست HTTP ورودی از سرویس خارجی' },
  { id: 'schedule', icon: Timer, label: 'زمان‌بندی', desc: 'اجرای دوره‌ای (هر N دقیقه/ساعت/روز)' },
  { id: 'order', icon: Zap, label: 'رویداد سفارش', desc: 'هنگام ثبت، تکمیل یا لغو سفارش' },
  { id: 'manual', icon: Globe, label: 'دستی', desc: 'اجرا از طریق API یا داشبورد' },
];

const actionTypes = [
  { id: 'http', icon: Globe, label: 'HTTP Request', desc: 'فراخوانی URL خارجی' },
  { id: 'message', icon: MessageSquare, label: 'ارسال پیام', desc: 'ارسال پیام به کانال یا کاربر' },
  { id: 'email', icon: Mail, label: 'ارسال ایمیل', desc: 'ارسال ایمیل قالب‌بندی‌شده' },
  { id: 'condition', icon: GitBranch, label: 'شرط (Branch)', desc: 'مسیریابی بر اساس شرط' },
  { id: 'delay', icon: Timer, label: 'تأخیر', desc: 'انتظار برای مدت مشخص' },
];

type Step = { id: string; type: string; label: string };

export default function NewWorkflow() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('webhook');
  const [steps, setSteps] = useState<Step[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const addStep = (type: string, label: string) => {
    setSteps(prev => [...prev, { id: `step-${Date.now()}`, type, label }]);
  };

  const removeStep = (id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const meRes = await fetch('/api/v1/me', { credentials: 'same-origin' });
      if (!meRes.ok) throw new Error('خطا در احراز هویت');
      const me = await meRes.json() as { workspaces?: Array<{ id: string }> };
      const workspaceId = me.workspaces?.[0]?.id;
      if (!workspaceId) throw new Error('فضای کاری یافت نشد');

      const definition = {
        trigger: { type: trigger },
        steps: steps.map(s => ({ id: s.id, type: s.type })),
      };

      const res = await fetch('/api/v1/automation/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        credentials: 'same-origin',
        body: JSON.stringify({ workspaceId, name: name.trim(), definition }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? 'ذخیره workflow با خطا مواجه شد');
      }
      setSubmitted(true);
      setTimeout(() => router.push('/automation'), 2000);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'خطای ناشناخته');
    } finally {
      setSubmitting(false);
    }
  }, [name, trigger, steps, router]);

  /* ── Success state ───────────────────────────────────────────── */
  if (submitted) {
    return (
      <AppShell>
        <main className="workspace-page-content">
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-xl)',
              padding: '56px 32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 20,
                background: 'rgba(22,163,74,.08)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--success)',
                marginBottom: 4,
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>
              Workflow ذخیره شد
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.85, maxWidth: 380, margin: 0 }}>
              Workflow در وضعیت Draft ذخیره شد. برای فعال‌سازی، آن را Publish کنید.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Link className="button primary" href="/automation">
                همه Workflow‌ها
              </Link>
              <Link className="button secondary" href="/automation/new">
                Workflow جدید
              </Link>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  const selectedTrigger = triggerTypes.find(t => t.id === trigger);

  return (
    <AppShell>
      <main className="workspace-page-content">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header style={{ marginBottom: 28 }}>
          <Link
            href="/automation"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--muted)',
              fontSize: 11,
              textDecoration: 'none',
              marginBottom: 12,
            }}
          >
            <ChevronLeft size={13} />
            اتوماسیون
          </Link>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <span className="eyebrow">اتوماسیون · Workflow جدید</span>
              <h1
                style={{
                  fontSize: 'clamp(22px, 3vw, 30px)',
                  margin: '5px 0 4px',
                  fontWeight: 800,
                  letterSpacing: '-.03em',
                }}
              >
                Workflow جدید
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
                Trigger، مراحل اجرا و شرط‌ها را تعریف کنید.
              </p>
            </div>
            <Link
              className="button secondary"
              href="/automation"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              <ArrowRight size={14} />
              انصراف
            </Link>
          </div>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 300px',
            gap: 20,
            alignItems: 'start',
          }}
        >
          {/* ── Left: main form ──────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Name */}
            <article
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 22px',
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '.1em',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                نام
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                  نام Workflow
                </span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: پاسخ خودکار به تیکت‌های پشتیبانی"
                  style={{
                    padding: '10px 13px',
                    borderRadius: 10,
                    border: `1.5px solid ${name.trim() ? 'var(--accent)' : 'var(--line)'}`,
                    background: 'var(--surface-2)',
                    fontSize: 14,
                    color: 'var(--ink)',
                    outline: 'none',
                    fontFamily: 'var(--font-fa)',
                    transition: 'border-color .15s',
                  }}
                />
              </label>
            </article>

            {/* Trigger */}
            <article
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 22px',
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '.1em',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                Trigger
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {triggerTypes.map(t => {
                  const isSelected = trigger === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTrigger(t.id)}
                      style={{
                        padding: '14px 15px',
                        borderRadius: 12,
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                        background: isSelected ? 'var(--accent-soft)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'right',
                        display: 'flex',
                        gap: 11,
                        alignItems: 'flex-start',
                        transition: 'border-color .15s, background .15s',
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          background: isSelected ? 'rgba(26,86,219,.12)' : 'var(--surface-2)',
                          display: 'grid',
                          placeItems: 'center',
                          color: isSelected ? 'var(--accent)' : 'var(--subtle)',
                          flexShrink: 0,
                        }}
                      >
                        <t.icon size={14} />
                      </div>
                      <span>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: isSelected ? 'var(--accent-strong)' : 'var(--ink)',
                            marginBottom: 2,
                          }}
                        >
                          {t.label}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
                          {t.desc}
                        </div>
                      </span>
                    </button>
                  );
                })}
              </div>
            </article>

            {/* Steps */}
            <article
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 22px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '.1em',
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                  }}
                >
                  مراحل اجرا
                </div>
                <span style={{ fontSize: 10, color: 'var(--subtle)' }}>
                  {steps.length} مرحله
                </span>
              </div>

              {/* Pipeline visualization */}
              {selectedTrigger && (
                <div
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: 'var(--accent-soft)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--accent)',
                      flexShrink: 0,
                    }}
                  >
                    <selectedTrigger.icon size={12} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                    Trigger: {selectedTrigger.label}
                  </span>
                </div>
              )}

              {steps.length === 0 && (
                <div
                  style={{
                    padding: '20px 0',
                    textAlign: 'center',
                    color: 'var(--subtle)',
                    fontSize: 11,
                  }}
                >
                  یک Action از پنل کنار اضافه کنید.
                </div>
              )}

              {steps.map((step, i) => (
                <div key={step.id}>
                  {/* connector line */}
                  {i > 0 && (
                    <div
                      style={{
                        width: 2,
                        height: 10,
                        background: 'var(--line)',
                        margin: '0 auto 0 auto',
                        marginInlineStart: 18,
                      }}
                    />
                  )}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line)',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        color: 'var(--subtle)',
                        minWidth: 18,
                        textAlign: 'center',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{step.label}</span>
                    <button
                      type="button"
                      onClick={() => removeStep(step.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--subtle)',
                        padding: 4,
                        borderRadius: 6,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                      aria-label="حذف مرحله"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </article>
          </div>

          {/* ── Right: actions sidebar ────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <article
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px 20px',
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '.1em',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {actionTypes.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => addStep(a.id, a.label)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 9,
                      border: '1.5px solid var(--line)',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'right',
                      transition: 'border-color .15s, background .15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(26,86,219,.3)';
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-soft)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)';
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'var(--surface-2)',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'var(--subtle)',
                        flexShrink: 0,
                      }}
                    >
                      <a.icon size={13} />
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                        {a.label}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--muted)' }}>{a.desc}</div>
                    </div>
                    <Plus size={12} style={{ color: 'var(--subtle)', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </article>

            {/* Save / Error */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {submitError && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    color: 'var(--danger)',
                    fontSize: 11,
                    padding: '10px 13px',
                    background: 'var(--danger-soft)',
                    borderRadius: 9,
                    border: '1px solid rgba(220,38,38,.15)',
                  }}
                >
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  {submitError}
                </div>
              )}
              <button
                type="button"
                className="button primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleSave}
                disabled={!name.trim() || submitting}
              >
                {submitting ? 'در حال ذخیره...' : 'ذخیره Workflow'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
