import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, Clock, Download, Package, RefreshCw, ShoppingBag } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { formatTomanFromIRR, statusLabel } from '../../../lib/format';

type TimelineStep = { label: string; time: string | null; done: boolean; active: boolean };

const ordersDetail: Record<string, {
  code: string; status: string; totalMinor: number; currency: string;
  createdAt: string; service: string; quantity: string; target: string;
  provider: string; timeline: TimelineStep[];
}> = {
  'ord-1': {
    code: '#DP-10482', status: 'PROCESSING', totalMinor: 2_900_000, currency: 'IRR',
    createdAt: '2026-10-02T08:18:00Z', service: 'فالوور اینستاگرام', quantity: '۱۰۰۰ فالوور', target: '@my_account',
    provider: 'Provider A',
    timeline: [
      { label: 'سفارش ثبت شد', time: '۱۴۰۵/۰۷/۱۱ · ۰۸:۱۸', done: true, active: false },
      { label: 'پرداخت تأیید شد', time: '۱۴۰۵/۰۷/۱۱ · ۰۸:۱۹', done: true, active: false },
      { label: 'در حال پردازش توسط تأمین‌کننده', time: '۱۴۰۵/۰۷/۱۱ · ۰۸:۲۲', done: false, active: true },
      { label: 'تحویل کامل', time: null, done: false, active: false },
    ],
  },
  'ord-2': {
    code: '#DP-10477', status: 'COMPLETED', totalMinor: 6_600_000, currency: 'IRR',
    createdAt: '2026-10-01T16:40:00Z', service: 'AI Writer Pro', quantity: '۱ ماه اشتراک', target: 'Workspace اصلی',
    provider: 'Internal',
    timeline: [
      { label: 'سفارش ثبت شد', time: '۱۴۰۵/۰۷/۱۰ · ۱۶:۴۰', done: true, active: false },
      { label: 'پرداخت تأیید شد', time: '۱۴۰۵/۰۷/۱۰ · ۱۶:۴۰', done: true, active: false },
      { label: 'فعال‌سازی سرویس', time: '۱۴۰۵/۰۷/۱۰ · ۱۶:۴۱', done: true, active: false },
      { label: 'تحویل کامل', time: '۱۴۰۵/۰۷/۱۰ · ۱۶:۴۱', done: true, active: false },
    ],
  },
  'ord-3': {
    code: '#DP-10469', status: 'QUEUED', totalMinor: 4_200_000, currency: 'IRR',
    createdAt: '2026-10-01T10:12:00Z', service: 'AI Image Studio', quantity: '۱ ماه اشتراک', target: 'Workspace اصلی',
    provider: 'Internal',
    timeline: [
      { label: 'سفارش ثبت شد', time: '۱۴۰۵/۰۷/۱۰ · ۱۰:۱۲', done: true, active: false },
      { label: 'پرداخت تأیید شد', time: '۱۴۰۵/۰۷/۱۰ · ۱۰:۱۳', done: true, active: false },
      { label: 'در صف پردازش', time: null, done: false, active: true },
      { label: 'تحویل کامل', time: null, done: false, active: false },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const order = ordersDetail[id];
  return { title: order ? `سفارش ${order.code}` : 'سفارش', robots: { index: false, follow: false } };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = ordersDetail[id];

  if (!order) {
    return (
      <AppShell>
        <main className="workspace-page-content">
          <div className="state-block state-empty" style={{ marginTop: 40 }}>
            <Package size={28}/>
            <h3>سفارش پیدا نشد</h3>
            <p>این سفارش وجود ندارد یا به حساب شما تعلق ندارد.</p>
            <Link href="/orders" className="button secondary" style={{ marginTop: 14, textDecoration: 'none' }}>
              بازگشت به لیست
            </Link>
          </div>
        </main>
      </AppShell>
    );
  }

  const statusClass = order.status === 'COMPLETED' ? 'success' : order.status === 'PROCESSING' ? 'info' : 'warning';

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <Link href="/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 11, textDecoration: 'none', marginBottom: 8 }}>
              <ArrowRight size={13}/>سفارش‌ها
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 'clamp(22px,3vw,32px)' }}>{order.code}</h1>
              <span className={`status-pill ${statusClass}`}>{statusLabel(order.status)}</span>
            </div>
            <p>{order.service} · {order.quantity}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {order.status === 'COMPLETED' && (
              <button className="button secondary" type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Download size={14}/>دریافت فاکتور
              </button>
            )}
            {(order.status === 'PROCESSING' || order.status === 'QUEUED') && (
              <button className="button secondary" type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <RefreshCw size={14}/>بروزرسانی وضعیت
              </button>
            )}
          </div>
        </header>

        <div className="order-detail-grid">
          {/* Timeline */}
          <article className="surface-panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">TIMELINE</p>
                <h2>وضعیت سفارش</h2>
              </div>
            </div>
            <div className="timeline-list">
              {order.timeline.map((step, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-dot-col">
                    <div className={`timeline-dot${step.done ? ' done' : step.active ? ' active' : ''}`}>
                      {step.done
                        ? <CheckCircle2 size={14}/>
                        : step.active
                          ? <Clock size={14}/>
                          : <Circle size={14}/>
                      }
                    </div>
                    <div className="timeline-line"/>
                  </div>
                  <div className="timeline-body">
                    <b>{step.label}</b>
                    {step.time && <time>{step.time}</time>}
                    {!step.time && step.active && <small>در حال انجام...</small>}
                    {!step.time && !step.active && <small>منتظر مرحله قبل</small>}
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* Meta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <div>
                  <p className="panel-kicker">DETAILS</p>
                  <h2>جزئیات</h2>
                </div>
              </div>
              <div className="order-meta-list">
                <div className="order-meta-row">
                  <span>کد سفارش</span>
                  <strong className="text-ltr">{order.code}</strong>
                </div>
                <div className="order-meta-row">
                  <span>سرویس</span>
                  <strong>{order.service}</strong>
                </div>
                <div className="order-meta-row">
                  <span>مقدار</span>
                  <strong>{order.quantity}</strong>
                </div>
                <div className="order-meta-row">
                  <span>هدف</span>
                  <strong className="text-ltr">{order.target}</strong>
                </div>
                <div className="order-meta-row">
                  <span>تأمین‌کننده</span>
                  <strong>{order.provider}</strong>
                </div>
                <div className="order-meta-row">
                  <span>مبلغ</span>
                  <strong>{formatTomanFromIRR(order.totalMinor)}</strong>
                </div>
              </div>
            </article>

            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <div>
                  <p className="panel-kicker">ACTIONS</p>
                  <h2>عملیات</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 9 }}>
                <Link href="/orders" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none', color: 'var(--muted)', fontSize: 11 }}>
                  <Package size={15}/>همه سفارش‌ها
                </Link>
                <Link href="/services" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none', color: 'var(--muted)', fontSize: 11 }}>
                  <ShoppingBag size={15}/>سفارش جدید
                </Link>
              </div>
            </article>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
