import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity, Bot, GitBranch, Play, Plus, Webhook, Zap,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { requireCurrentUser } from '../../server/identity/request-user';
import { query } from '../../server/core/db';

export const metadata: Metadata = { title: 'اتوماسیون', robots: { index: false, follow: false } };

export default async function Automation() {
  let userId: string;
  try {
    userId = await requireCurrentUser();
  } catch {
    redirect('/auth');
  }

  const memberships = await query<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_members WHERE user_id=$1 AND status='ACTIVE' ORDER BY created_at LIMIT 1`,
    [userId],
  );
  const workspaceId = memberships.rows[0]?.workspace_id ?? null;

  const workflows = workspaceId
    ? await query<{ id: string; name: string; active: boolean; version: number | null; createdAt: string }>(
        `SELECT w.id, w.name, w.active,
                (SELECT MAX(version) FROM workflow_versions WHERE workflow_id=w.id) AS version,
                w.created_at AS "createdAt"
         FROM workflows w WHERE w.workspace_id=$1 ORDER BY w.created_at DESC LIMIT 20`,
        [workspaceId],
      ).then(r => r.rows)
    : [];

  const active = workflows.filter(w => w.active).length;
  const draft = workflows.filter(w => !w.active).length;

  return (
    <AppShell>
      <main className="workspace-page-content">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="page-header" style={{ marginBottom: 28 }}>
          <div>
            <span className="eyebrow">اتوماسیون</span>
            <h1>فرآیندهای خودکار</h1>
            <p>
              رویداد یا زمان‌بندی را انتخاب کنید، مراحل اجرا را تعریف کنید و بگذارید سیستم کار کند.
            </p>
          </div>
          <Link className="button primary" href="/automation/new">
            <Plus size={15} />
            فرآیند جدید
          </Link>
        </header>

        {/* ── Summary strip ─────────────────────────────────────── */}
        {workflows.length > 0 && (
          <div
            data-stack
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                کل Workflow
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.04em', color: 'var(--ink)' }}>
                {workflows.length}
              </div>
            </div>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                فعال
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: '-.04em',
                  color: active > 0 ? 'var(--success)' : 'var(--ink)',
                }}
              >
                {active}
              </div>
            </div>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                پیش‌نویس
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: '-.04em',
                  color: draft > 0 ? 'var(--warning)' : 'var(--ink)',
                }}
              >
                {draft}
              </div>
            </div>
          </div>
        )}

        {/* ── فرآیند list or empty state ───────────────────────── */}
        {workflows.length === 0 ? (
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
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                background: 'var(--accent-soft)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--accent)',
                marginBottom: 4,
              }}
            >
              <Zap size={24} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: '-.02em' }}>
              هنوز فرآیند خودکاری ندارید
            </h3>
            <p
              style={{
                color: 'var(--muted)',
                fontSize: 12,
                lineHeight: 1.9,
                maxWidth: 400,
                margin: 0,
              }}
            >
              با اتوماسیون می‌توانید کارهای تکراری را حذف کنید. یک رویداد یا زمان‌بندی انتخاب کنید، مراحل را تعریف کنید و سیستم بقیه را انجام می‌دهد.
            </p>
            <Link
              href="/automation/new"
              className="button primary"
              style={{ marginTop: 8, textDecoration: 'none' }}
            >
              <Plus size={14} />
              ساخت اولین فرآیند
            </Link>
          </div>
        ) : (
          <article
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                padding: '18px 22px 14px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '.1em',
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                  }}
                >
                  Workflows
                </span>
                <h2 style={{ fontSize: 15, margin: '3px 0 0', fontWeight: 700, letterSpacing: '-.02em' }}>
                  Workflow‌ها
                </h2>
              </div>
              <Link
                href="/automation/new"
                className="button secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={13} />
                جدید
              </Link>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>نام</th>
                  <th>نسخه</th>
                  <th>وضعیت</th>
                  <th>تاریخ ساخت</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {workflows.map(w => (
                  <tr key={w.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 9,
                            background: w.active ? 'rgba(22,163,74,.08)' : 'var(--surface-2)',
                            display: 'grid',
                            placeItems: 'center',
                            color: w.active ? 'var(--success)' : 'var(--subtle)',
                            flexShrink: 0,
                          }}
                        >
                          <Zap size={13} />
                        </div>
                        <strong style={{ fontSize: 13 }}>{w.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span
                        className="text-ltr"
                        style={{
                          fontSize: 10,
                          fontFamily: 'var(--font-latin)',
                          background: 'var(--surface-2)',
                          padding: '2px 7px',
                          borderRadius: 5,
                          color: 'var(--muted)',
                        }}
                      >
                        v{w.version ?? 1}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${w.active ? 'success' : 'warning'}`}>
                        {w.active ? 'فعال' : 'پیش‌نویس'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 11 }}>
                      {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(
                        new Date(w.createdAt),
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/automation/workflow/${w.id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          color: 'var(--accent)',
                          fontSize: 11,
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        <Activity size={13} />
                        جزئیات
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}

        {/* ── Capability cards ───────────────────────────────────── */}
        <section>
          <div style={{ marginBottom: 14 }}>
            <span className="eyebrow">قابلیت‌ها</span>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 0', letterSpacing: '-.02em' }}>
              چه فرآیندهایی می‌توانید خودکار کنید
            </h2>
          </div>
          <div className="product-card-grid-premium">
            <article className="product-card">
              <div className="product-card-icon"><Play size={18} /></div>
              <div className="product-card-copy">
                <div className="product-card-title"><h2>ساخت فرآیند</h2></div>
                <p>مراحل اجرا را تعریف کنید. هر تغییر نسخه‌بندی می‌شود و تاریخچه کامل نگه داشته می‌شود.</p>
                <span>پیش‌نویس · منتشرشده · نسخه‌بندی‌شده</span>
              </div>
            </article>
            <article className="product-card">
              <div className="product-card-icon"><Webhook size={18} /></div>
              <div className="product-card-copy">
                <div className="product-card-title"><h2>رویداد و Webhook</h2></div>
                <p>فرآیند را با رویداد سفارش، زمان‌بندی یا درخواست HTTP از سرویس دیگری شروع کنید.</p>
                <span>امضاشده · ایمن · قابل‌ردیابی</span>
              </div>
            </article>
            <article className="product-card">
              <div className="product-card-icon"><Bot size={18} /></div>
              <div className="product-card-copy">
                <div className="product-card-title"><h2>عامل‌های هوشمند</h2></div>
                <p>هوش مصنوعی را در فرآیند خود داشته باشید؛ با ابزار، دانش و کنترل کامل رفتار.</p>
                <span>کنترل‌شده · قابل‌حسابرسی</span>
              </div>
            </article>
            <article className="product-card">
              <div className="product-card-icon"><GitBranch size={18} /></div>
              <div className="product-card-copy">
                <div className="product-card-title"><h2>شرط و انشعاب</h2></div>
                <p>مسیر اجرا را بر اساس شرط تقسیم کنید و خطاها را با guard مدیریت کنید.</p>
                <span>قطعی · قابل‌مشاهده</span>
              </div>
            </article>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
