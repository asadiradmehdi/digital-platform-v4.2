'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
import { formatMoney } from '../../../lib/format';

type Plan = {
  id: string; name: string; slug: string; price_minor: string; currency: string;
  billing_interval: string; description: string | null;
  entitlements: Array<{ entitlement_key: string; value: unknown }>;
};

function formatPrice(minor: string, currency: string): string {
  const c = currency.trim();
  // Plan prices are IRT (toman); an IRR amount is rial and is divided by 10 — never shown as toman.
  if (c === 'IRT' || c === 'IRR') return formatMoney(minor, c);
  return new Intl.NumberFormat('fa-IR').format(Number(minor) / 100) + ' ' + c;
}

function intervalLabel(interval: string): string {
  const map: Record<string, string> = { monthly: 'ماهانه', weekly: 'هفتگی', annual: 'سالانه', quarterly: 'سه‌ماهه' };
  return map[interval] ?? interval;
}

function SubscriptionNewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillPlan = searchParams.get('plan') ?? '';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>(prefillPlan);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const idemKey = useRef<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/plans').then(r => r.json()) as Promise<{ items: Plan[] }>,
      fetch('/api/v1/me').then(r => r.json()) as Promise<{ workspaces?: Array<{ id: string }> }>,
    ]).then(([plansData, meData]) => {
      setPlans(plansData.items ?? []);
      setWorkspaceId(meData.workspaces?.[0]?.id ?? null);
      if (!prefillPlan && plansData.items?.[0]) setSelectedPlan(plansData.items[0].id);
    }).catch(() => setError('خطا در بارگذاری اطلاعات'))
      .finally(() => setLoading(false));
  }, [prefillPlan]);

  async function handleSubscribe() {
    if (!selectedPlan || !workspaceId) {
      setError(!workspaceId ? 'لطفاً ابتدا وارد شوید' : 'پلن را انتخاب کنید');
      return;
    }
    setSubmitting(true);
    setError(null);
    // One key per attempt: a retried request returns the same subscription and never charges twice.
    idemKey.current ??= crypto.randomUUID();
    try {
      const res = await fetch('/api/v1/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey.current },
        body: JSON.stringify({ workspaceId, planId: selectedPlan }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setError(body.error?.message ?? 'خطا در ایجاد اشتراک');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push('/subscriptions'), 1500);
    } catch {
      setError('خطا در ارتباط با سرور');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <article className="surface-panel" style={{ padding: 40, textAlign: 'center' }}>
        <CheckCircle2 size={40} style={{ color: 'var(--success)', margin: '0 auto 16px', display: 'block' }}/>
        <h2>اشتراک با موفقیت فعال شد</h2>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>در حال انتقال به صفحه اشتراک‌ها...</p>
      </article>
    );
  }

  const selected = plans.find(p => p.id === selectedPlan);

  return (
    <div className="settings-layout">
      <article className="surface-panel" style={{ padding: 24 }}>
        <div className="panel-head"><div><span className="panel-kicker">PLANS</span><h2>انتخاب پلن</h2></div></div>
        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 16 }}>در حال بارگذاری...</p>
        ) : plans.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 16 }}>پلنی برای نمایش وجود ندارد.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {plans.map(p => (
              <label key={p.id} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 10, border: `1px solid ${selectedPlan === p.id ? 'var(--accent)' : 'var(--line)'}`, background: selectedPlan === p.id ? 'var(--accent-soft)' : 'var(--surface-2)', cursor: 'pointer' }}>
                <input type="radio" name="plan" value={p.id} checked={selectedPlan === p.id} onChange={() => setSelectedPlan(p.id)} style={{ marginTop: 3 }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: 13 }}>{p.name}</strong>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-strong)' }}>{formatPrice(p.price_minor, p.currency)}<small style={{ fontWeight: 400, color: 'var(--muted)', marginInlineStart: 4 }}>/ {intervalLabel(p.billing_interval)}</small></span>
                  </div>
                  {p.description && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>{p.description}</p>}
                  {p.entitlements.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {p.entitlements.map(e => (
                        <span key={e.entitlement_key} style={{ fontSize: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 5, padding: '2px 7px' }}>{e.entitlement_key}</span>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </article>

      <article className="surface-panel" style={{ padding: 24 }}>
        <div className="panel-head"><div><span className="panel-kicker">SUMMARY</span><h2>خلاصه سفارش</h2></div></div>
        {selected ? (
          <div style={{ marginTop: 14 }}>
            <div className="metric-grid-4" style={{ marginBottom: 18 }}>
              <div className="metric-tile"><span>پلن انتخابی</span><strong>{selected.name}</strong></div>
              <div className="metric-tile"><span>قیمت</span><strong>{formatPrice(selected.price_minor, selected.currency)}</strong></div>
              <div className="metric-tile"><span>چرخه صورتحساب</span><strong>{intervalLabel(selected.billing_interval)}</strong></div>
              <div className="metric-tile"><span>روش پرداخت</span><strong>کیف پول</strong></div>
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</p>}
            {!workspaceId && (
              <p style={{ color: 'var(--warning)', fontSize: 12, marginBottom: 12 }}>برای خرید اشتراک باید <Link href="/auth">وارد شوید</Link>.</p>
            )}
            <button className="button primary" type="button" disabled={submitting || !workspaceId} onClick={handleSubscribe} style={{ width: '100%' }}>
              {submitting ? '...' : 'فعال‌سازی اشتراک'}
            </button>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 14 }}>یک پلن انتخاب کنید.</p>
        )}
      </article>
    </div>
  );
}

export default function SubscriptionNewPage() {
  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div><span className="eyebrow">اشتراک‌ها</span><h1>خرید اشتراک</h1><p>پلن مناسب را انتخاب کنید و اشتراک را از کیف پول شارژ کنید.</p></div>
          <Link className="button secondary" href="/subscriptions"><ArrowRight size={15}/>اشتراک‌های من</Link>
        </header>
        <SystemStrip/>
        <Suspense fallback={<div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>در حال بارگذاری...</div>}>
          <SubscriptionNewInner/>
        </Suspense>
      </main>
    </AppShell>
  );
}
