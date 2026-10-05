'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, GitBranch, Globe, Mail,
  MessageSquare, Plus, Timer, Trash2, Webhook, Zap,
} from 'lucide-react';
import { AppShell } from '../../../components/AppShell';

const triggerTypes = [
  { id: 'webhook', icon: Webhook, label: 'Webhook', desc: 'درخواست HTTP ورودی از سرویس خارجی' },
  { id: 'schedule', icon: Timer, label: 'زمان‌بندی', desc: 'اجرای دوره‌ای (هر N دقیقه/ساعت/روز)' },
  { id: 'order', icon: Zap, label: 'رویداد سفارش', desc: 'هنگام ثبت، تکمیل یا لغو سفارش' },
  { id: 'manual', icon: Globe, label: 'دستی', desc: 'اجرا از طریق API یا داشبورد' },
];

const actionTypes = [
  { id: 'http', icon: Globe, label: 'HTTP Request' },
  { id: 'message', icon: MessageSquare, label: 'ارسال پیام' },
  { id: 'email', icon: Mail, label: 'ارسال ایمیل' },
  { id: 'condition', icon: GitBranch, label: 'شرط (Branch)' },
  { id: 'delay', icon: Timer, label: 'تأخیر' },
];

type Step = { id: string; type: string; label: string };

export default function NewWorkflow() {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('webhook');
  const [steps, setSteps] = useState<Step[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const addStep = (type: string, label: string) => {
    setSteps(prev => [...prev, { id: `step-${Date.now()}`, type, label }]);
  };

  const removeStep = (id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  if (submitted) {
    return (
      <AppShell>
        <main className="workspace-page-content">
          <article className="surface-panel" style={{ padding: 32, textAlign: 'center' }}>
            <CheckCircle2 size={36} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
            <h2 style={{ marginBottom: 8 }}>Workflow ذخیره شد</h2>
            <p style={{ color: 'var(--subtle)', marginBottom: 24 }}>
              Workflow در وضعیت Draft ذخیره شد. برای فعال‌سازی آن را Publish کنید.
            </p>
            <div className="hero-actions" style={{ justifyContent: 'center' }}>
              <Link className="button primary" href="/automation">همه Workflow‌ها</Link>
              <Link className="button secondary" href="/automation/new">Workflow جدید</Link>
            </div>
          </article>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div>
            <span className="eyebrow">AUTOMATION / NEW WORKFLOW</span>
            <h1>Workflow جدید</h1>
            <p>Trigger، مراحل اجرا و شرط‌ها را تعریف کنید.</p>
          </div>
          <Link className="button secondary" href="/automation">
            <ArrowRight size={15} />بازگشت
          </Link>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <article className="surface-panel" style={{ padding: 20 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>نام Workflow</span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: پاسخ خودکار به تیکت‌های پشتیبانی"
                  style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: 14 }}
                />
              </label>
            </article>

            <article className="surface-panel" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Trigger
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {triggerTypes.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTrigger(t.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `1.5px solid ${trigger === t.id ? 'var(--brand)' : 'var(--border)'}`,
                      background: trigger === t.id ? 'var(--surface-2)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'right',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <t.icon size={16} style={{ color: trigger === t.id ? 'var(--brand)' : 'var(--subtle)', marginTop: 2, flexShrink: 0 }} />
                    <span>
                      <div style={{ fontSize: 13, fontWeight: 600, color: trigger === t.id ? 'var(--brand)' : 'var(--text)' }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 2 }}>{t.desc}</div>
                    </span>
                  </button>
                ))}
              </div>
            </article>

            <article className="surface-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                  مراحل اجرا
                </h2>
                <span style={{ fontSize: 11, color: 'var(--subtle)' }}>{steps.length} مرحله</span>
              </div>

              {steps.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--subtle)', margin: '0 0 12px', padding: '16px 0', textAlign: 'center' }}>
                  یک Action از پنل کنار اضافه کنید.
                </p>
              )}

              {steps.map((step, i) => (
                <div
                  key={step.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--surface-2)',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--subtle)', minWidth: 18 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{step.label}</span>
                  <button
                    type="button"
                    onClick={() => removeStep(step.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtle)', padding: 4 }}
                    aria-label="حذف مرحله"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </article>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <article className="surface-panel" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                اضافه کردن Action
              </h2>
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
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1.5px solid var(--border)',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text)',
                    }}
                  >
                    <a.icon size={15} style={{ color: 'var(--subtle)' }} />
                    {a.label}
                    <Plus size={13} style={{ marginInlineStart: 'auto', color: 'var(--subtle)' }} />
                  </button>
                ))}
              </div>
            </article>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="button primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setSubmitted(true)}
                disabled={!name.trim()}
              >
                ذخیره Workflow
              </button>
              <Link href="/automation" className="button secondary" style={{ width: '100%', justifyContent: 'center', textAlign: 'center' }}>
                انصراف
              </Link>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
