'use client';
import { useCallback, useEffect, useState } from 'react';
import { DollarSign, RefreshCw, ShieldAlert, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { InsightPanel, SurfaceHero } from '../../../components/ProductSurface';

type FxRateRow = {
  id: string; baseCurrency: string; quoteCurrency: string;
  rateNumerator: string; rateDenominator: string;
  source: string; fetchedAt: string; isVerified: boolean;
  stale: boolean; ageSeconds: number;
};

type PricingRuleRow = {
  id: string; targetType: string; targetId: string;
  baseAmountMinor: string; baseCurrency: string;
  marginPercent: number; marginMode: string;
  roundingIncrementMinor: string;
  minPriceMinor: string | null; maxPriceMinor: string | null;
  staleRatePolicy: string; maxRateAgeSeconds: number;
  active: boolean;
};

type NewRule = {
  targetType: string; targetId: string;
  baseAmountMinor: string; baseCurrency: string;
  marginPercent: string; marginMode: string;
  staleRatePolicy: string; maxRateAgeSeconds: string;
};

const EMPTY_RULE: NewRule = {
  targetType: 'PLAN', targetId: '', baseAmountMinor: '', baseCurrency: 'USD',
  marginPercent: '10', marginMode: 'MARKUP', staleRatePolicy: 'USE_LAST_KNOWN_GOOD',
  maxRateAgeSeconds: '3600',
};

function ageLabel(secs: number): string {
  if (secs < 60) return `${secs} ثانیه`;
  if (secs < 3600) return `${Math.floor(secs / 60)} دقیقه`;
  return `${Math.floor(secs / 3600)} ساعت`;
}

function policyLabel(p: string): string {
  if (p === 'BLOCK_PURCHASE') return 'توقف خرید';
  if (p === 'FREEZE_PRICE') return 'قیمت منجمد';
  return 'آخرین نرخ معتبر';
}

export default function PricingSettingsPage() {
  const [rates, setRates] = useState<FxRateRow[]>([]);
  const [rules, setRules] = useState<PricingRuleRow[]>([]);
  const [loadingRates, setLoadingRates] = useState(true);
  const [loadingRules, setLoadingRules] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<NewRule>(EMPTY_RULE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);

  const loadRates = useCallback(() => {
    setLoadingRates(true);
    fetch('/api/v1/pricing/fx-rates')
      .then(r => r.json())
      .then(d => setRates(d.items ?? []))
      .catch(() => setError('خطا در بارگذاری نرخ‌های ارز'))
      .finally(() => setLoadingRates(false));
  }, []);

  const loadRules = useCallback(() => {
    setLoadingRules(true);
    fetch('/api/v1/pricing/rules')
      .then(r => r.json())
      .then(d => setRules(d.items ?? []))
      .catch(() => setError('خطا در بارگذاری قوانین قیمت‌گذاری'))
      .finally(() => setLoadingRules(false));
  }, []);

  useEffect(() => { loadRates(); loadRules(); }, [loadRates, loadRules]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitOk(false);
    try {
      const res = await fetch('/api/v1/pricing/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: form.targetType,
          targetId: form.targetId,
          baseAmountMinor: form.baseAmountMinor,
          baseCurrency: form.baseCurrency,
          marginPercent: parseFloat(form.marginPercent),
          marginMode: form.marginMode,
          staleRatePolicy: form.staleRatePolicy,
          maxRateAgeSeconds: parseInt(form.maxRateAgeSeconds, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? 'خطای ناشناخته'); return; }
      setSubmitOk(true);
      setForm(EMPTY_RULE);
      loadRules();
    } catch {
      setSubmitError('خطا در ارسال درخواست');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="workspace-page-content" dir="rtl">
        <SurfaceHero
          eyebrow="CONTROL PLANE / PRICING"
          title="قیمت‌گذاری دقیق."
          description="نرخ‌های ارز، قوانین قیمت‌گذاری و سیاست مدیریت نرخ منقضی را در یک مرکز کنترل مشاهده و ویرایش کنید."
        />

        {error && (
          <div className="state-block state-block--error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* FX Rates */}
        <section className="product-card-grid-premium">
          <InsightPanel kicker="LIVE DATA" title="نرخ‌های ارز">
            <div className="panel-toolbar">
              <button className="button secondary" onClick={loadRates} disabled={loadingRates} aria-label="بارگذاری مجدد نرخ‌ها">
                <RefreshCw size={14} className={loadingRates ? 'spin' : ''} />
                <span>{loadingRates ? 'در حال بارگذاری…' : 'بروزرسانی'}</span>
              </button>
            </div>
            {loadingRates ? (
              <div className="skeleton-rows">
                {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
              </div>
            ) : rates.length === 0 ? (
              <div className="empty-state"><DollarSign size={22} /><p>هیچ نرخ ارز تأیید شده‌ای موجود نیست.</p></div>
            ) : (
              <table className="data-table" aria-label="نرخ‌های ارز">
                <thead>
                  <tr>
                    <th>جفت ارز</th>
                    <th>نسبت</th>
                    <th>منبع</th>
                    <th>سن</th>
                    <th>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map(r => (
                    <tr key={r.id} className={r.stale ? 'row--stale' : ''}>
                      <td><code>{r.baseCurrency}/{r.quoteCurrency}</code></td>
                      <td><code>{r.rateNumerator}/{r.rateDenominator}</code></td>
                      <td>{r.source}</td>
                      <td className="mono">{ageLabel(r.ageSeconds)}</td>
                      <td>
                        {r.stale ? (
                          <span className="status-badge status-badge--warning">
                            <Clock size={12} /> منقضی
                          </span>
                        ) : (
                          <span className="status-badge status-badge--success">معتبر</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </InsightPanel>
        </section>

        {/* Pricing Rules */}
        <section className="product-card-grid-premium">
          <InsightPanel kicker="CONFIG" title="قوانین قیمت‌گذاری">
            {loadingRules ? (
              <div className="skeleton-rows">
                {[1, 2].map(i => <div key={i} className="skeleton-row" />)}
              </div>
            ) : rules.length === 0 ? (
              <div className="empty-state"><TrendingUp size={22} /><p>هیچ قانون قیمت‌گذاری‌ای ثبت نشده است.</p></div>
            ) : (
              <table className="data-table" aria-label="قوانین قیمت‌گذاری">
                <thead>
                  <tr>
                    <th>هدف</th>
                    <th>شناسه هدف</th>
                    <th>مبلغ پایه</th>
                    <th>حاشیه سود</th>
                    <th>سیاست نرخ منقضی</th>
                    <th>حداکثر سن نرخ</th>
                    <th>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(r => (
                    <tr key={r.id}>
                      <td>{r.targetType}</td>
                      <td><code>{r.targetId}</code></td>
                      <td className="mono">{r.baseAmountMinor} {r.baseCurrency}</td>
                      <td className="mono">{r.marginPercent}٪ ({r.marginMode})</td>
                      <td>
                        <span className={`status-badge ${r.staleRatePolicy === 'BLOCK_PURCHASE' ? 'status-badge--error' : r.staleRatePolicy === 'FREEZE_PRICE' ? 'status-badge--warning' : 'status-badge--neutral'}`}>
                          <ShieldAlert size={12} /> {policyLabel(r.staleRatePolicy)}
                        </span>
                      </td>
                      <td className="mono">{ageLabel(r.maxRateAgeSeconds)}</td>
                      <td>
                        <span className={`status-badge ${r.active ? 'status-badge--success' : 'status-badge--neutral'}`}>
                          {r.active ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </InsightPanel>
        </section>

        {/* Add / Update Rule Form */}
        <section className="product-card-grid-premium">
          <InsightPanel kicker="ADMIN" title="افزودن یا ویرایش قانون">
            <form onSubmit={handleSubmit} className="settings-form" noValidate>
              <div className="form-row">
                <label htmlFor="targetType">نوع هدف</label>
                <select id="targetType" value={form.targetType} onChange={e => setForm(f => ({ ...f, targetType: e.target.value }))}>
                  <option value="PLAN">PLAN</option>
                  <option value="SERVICE">SERVICE</option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="targetId">شناسه هدف</label>
                <input id="targetId" type="text" value={form.targetId} onChange={e => setForm(f => ({ ...f, targetId: e.target.value }))} required placeholder="UUID یا slug پلن/سرویس" />
              </div>
              <div className="form-row">
                <label htmlFor="baseAmountMinor">مبلغ پایه (ریز)</label>
                <input id="baseAmountMinor" type="text" inputMode="numeric" pattern="[0-9]+" value={form.baseAmountMinor} onChange={e => setForm(f => ({ ...f, baseAmountMinor: e.target.value }))} required placeholder="مثال: 1000000" />
              </div>
              <div className="form-row">
                <label htmlFor="baseCurrency">ارز پایه</label>
                <select id="baseCurrency" value={form.baseCurrency} onChange={e => setForm(f => ({ ...f, baseCurrency: e.target.value }))}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="IRR">IRR</option>
                  <option value="IRT">IRT</option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="marginPercent">حاشیه سود (٪)</label>
                <input id="marginPercent" type="number" min="0" max="1000" step="0.01" value={form.marginPercent} onChange={e => setForm(f => ({ ...f, marginPercent: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label htmlFor="marginMode">نوع حاشیه</label>
                <select id="marginMode" value={form.marginMode} onChange={e => setForm(f => ({ ...f, marginMode: e.target.value }))}>
                  <option value="MARKUP">MARKUP (افزودنی)</option>
                  <option value="MARGIN">MARGIN (درصدی)</option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="staleRatePolicy">سیاست نرخ منقضی</label>
                <select id="staleRatePolicy" value={form.staleRatePolicy} onChange={e => setForm(f => ({ ...f, staleRatePolicy: e.target.value }))}>
                  <option value="USE_LAST_KNOWN_GOOD">استفاده از آخرین نرخ معتبر</option>
                  <option value="FREEZE_PRICE">انجماد قیمت</option>
                  <option value="BLOCK_PURCHASE">توقف خرید</option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="maxRateAgeSeconds">حداکثر سن نرخ (ثانیه)</label>
                <input id="maxRateAgeSeconds" type="number" min="60" step="60" value={form.maxRateAgeSeconds} onChange={e => setForm(f => ({ ...f, maxRateAgeSeconds: e.target.value }))} required />
              </div>

              {submitError && (
                <div className="state-block state-block--error" role="alert">
                  <AlertTriangle size={14} /><span>{submitError}</span>
                </div>
              )}
              {submitOk && (
                <div className="state-block state-block--success" role="status">
                  <span>قانون با موفقیت ذخیره شد.</span>
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'در حال ذخیره…' : 'ذخیره قانون'}
                </button>
              </div>
            </form>
          </InsightPanel>
        </section>
      </main>
    </AppShell>
  );
}
