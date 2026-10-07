import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import {
  Activity, ArrowRight, CheckCircle2, ChevronLeft,
  Clock3, Timer, XCircle, Zap,
} from 'lucide-react';
import { AppShell } from '../../../../components/AppShell';
import { requireCurrentUser } from '../../../../server/identity/request-user';
import { query } from '../../../../server/core/db';

export const metadata: Metadata = { title: 'جزئیات Workflow', robots: { index: false, follow: false } };

export default async function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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
  if (!workspaceId) redirect('/auth');

  const wfRes = await query<{
    id: string; name: string; active: boolean; triggerType: string | null; createdAt: string;
  }>(
    `SELECT id, name, active, trigger_type AS "triggerType", created_at AS "createdAt"
     FROM workflows WHERE id=$1 AND workspace_id=$2`,
    [id, workspaceId],
  );
  const wf = wfRes.rows[0];
  if (!wf) notFound();

  const runsRes = await query<{
    id: string; status: string; startedAt: string; finishedAt: string | null; errorMessage: string | null;
  }>(
    `SELECT id, status, started_at AS "startedAt", finished_at AS "finishedAt", error_message AS "errorMessage"
     FROM workflow_runs WHERE workflow_id=$1 ORDER BY started_at DESC LIMIT 20`,
    [id],
  );
  const runs = runsRes.rows;

  const runStatusClass = (s: string) =>
    s === 'COMPLETED' ? 'success' : s === 'FAILED' ? 'danger' : s === 'RUNNING' ? 'info' : 'warning';

  const runStatusLabel = (s: string) =>
    ({ COMPLETED: 'موفق', FAILED: 'ناموفق', RUNNING: 'در حال اجرا', QUEUED: 'در صف' }[s] ?? s);

  const runStatusIcon = (s: string) => {
    if (s === 'COMPLETED') return <CheckCircle2 size={13} />;
    if (s === 'FAILED') return <XCircle size={13} />;
    if (s === 'RUNNING') return <Activity size={13} />;
    return <Timer size={13} />;
  };

  const completedRuns = runs.filter(r => r.status === 'COMPLETED').length;
  const failedRuns = runs.filter(r => r.status === 'FAILED').length;

  const successRate = runs.length > 0
    ? Math.round((completedRuns / runs.length) * 100)
    : null;

  const formatDuration = (startedAt: string, finishedAt: string | null) => {
    if (!finishedAt) return '—';
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <AppShell>
      <main className="workspace-page-content">
        {/* ── Breadcrumb + header ─────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
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
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 15,
                  background: wf.active ? 'rgba(22,163,74,.08)' : 'var(--surface-2)',
                  display: 'grid',
                  placeItems: 'center',
                  color: wf.active ? 'var(--success)' : 'var(--subtle)',
                  flexShrink: 0,
                  border: '1px solid var(--line)',
                }}
              >
                <Zap size={20} />
              </div>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 'clamp(20px, 3vw, 28px)',
                    fontWeight: 800,
                    letterSpacing: '-.03em',
                    lineHeight: 1.2,
                  }}
                >
                  {wf.name}
                </h1>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <span className={`status-pill ${wf.active ? 'success' : 'warning'}`}>
                    {wf.active ? 'فعال' : 'پیش‌نویس'}
                  </span>
                  {wf.triggerType && (
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                      نقطه شروع: <span className="text-ltr" style={{ fontFamily: 'var(--font-latin)' }}>{wf.triggerType}</span>
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--subtle)' }}>
                    ساخته‌شده {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(wf.createdAt))}
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/automation"
              className="button secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              <ArrowRight size={14} />
              همه Workflow‌ها
            </Link>
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────────────── */}
        {runs.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div className="metric-tile">
              <span>کل اجراها</span>
              <strong>{runs.length}</strong>
              <small>ثبت‌شده</small>
            </div>
            <div className="metric-tile">
              <span>موفق</span>
              <strong style={{ color: 'var(--success)' }}>{completedRuns}</strong>
              <small>تکمیل‌شده</small>
            </div>
            <div className="metric-tile">
              <span>ناموفق</span>
              <strong style={{ color: failedRuns > 0 ? 'var(--danger)' : 'var(--ink)' }}>
                {failedRuns}
              </strong>
              <small>با خطا</small>
            </div>
            <div className="metric-tile">
              <span>نرخ موفقیت</span>
              <strong
                style={{
                  color:
                    successRate === null
                      ? 'var(--ink)'
                      : successRate >= 90
                      ? 'var(--success)'
                      : successRate >= 70
                      ? 'var(--warning)'
                      : 'var(--danger)',
                }}
              >
                {successRate !== null ? `${successRate}٪` : '—'}
              </strong>
              <small>از کل اجراها</small>
            </div>
          </div>
        )}

        {/* ── Run history ────────────────────────────────────────── */}
        <article
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
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
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '.1em',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                }}
              >
                تاریخچه
              </span>
              <h2 style={{ fontSize: 15, margin: '3px 0 0', fontWeight: 700, letterSpacing: '-.02em' }}>
                اجراهای اخیر
              </h2>
            </div>
            {runs.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--subtle)' }}>
                {runs.length} اجرای اخیر
              </span>
            )}
          </div>

          {runs.length === 0 ? (
            <div
              style={{
                padding: '48px 32px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 15,
                  background: 'var(--surface-2)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--subtle)',
                }}
              >
                <Activity size={20} />
              </div>
              <h3 style={{ fontSize: 14, margin: 0, fontWeight: 700 }}>
                هنوز اجرایی ثبت نشده
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.9, maxWidth: 340, margin: 0 }}>
                هر بار که این فرآیند اجرا شود، وضعیت، زمان و نتیجه آن اینجا ثبت می‌شود.
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>وضعیت</th>
                  <th>شروع</th>
                  <th>مدت</th>
                  <th>خطا</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span
                        className={`status-pill ${runStatusClass(r.status)}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        {runStatusIcon(r.status)}
                        {runStatusLabel(r.status)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock3 size={11} style={{ color: 'var(--subtle)', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {new Intl.DateTimeFormat('fa-IR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(r.startedAt))}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="text-ltr"
                        style={{
                          fontSize: 10,
                          fontFamily: 'var(--font-latin)',
                          color: 'var(--muted)',
                        }}
                      >
                        {formatDuration(r.startedAt, r.finishedAt)}
                      </span>
                    </td>
                    <td>
                      {r.errorMessage ? (
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--danger)',
                            maxWidth: 240,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                          title={r.errorMessage}
                        >
                          {r.errorMessage}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--subtle)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </main>
    </AppShell>
  );
}
