import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { Activity, ArrowRight, CheckCircle2, Circle, Play, StopCircle } from 'lucide-react';
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
    ({ COMPLETED: 'تکمیل', FAILED: 'ناموفق', RUNNING: 'در حال اجرا', QUEUED: 'در صف' }[s] ?? s);

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <Link href="/automation" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 11, textDecoration: 'none', marginBottom: 8 }}>
              <ArrowRight size={13}/>اتوماسیون
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 'clamp(22px,3vw,32px)' }}>{wf.name}</h1>
              <span className={`status-pill ${wf.active ? 'success' : 'warning'}`}>{wf.active ? 'فعال' : 'Draft'}</span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 12 }}>
              {wf.triggerType ?? 'بدون Trigger'} · ساخته‌شده {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(wf.createdAt))}
            </p>
          </div>
        </header>

        <article className="surface-panel data-panel">
          <div className="panel-head" style={{ marginBottom: 14 }}>
            <div><span className="panel-kicker">RUN HISTORY</span><h2>تاریخچه اجرا</h2></div>
          </div>
          {runs.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 120 }}>
              <div className="empty-mark"><Activity size={20}/></div>
              <h3>هنوز اجرایی ثبت نشده</h3>
              <p>هرگاه این Workflow اجرا شود، رکورد آن اینجا نمایش داده می‌شود.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>وضعیت</th><th>شروع</th><th>پایان</th><th>خطا</th></tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id}>
                    <td><span className={`status-pill ${runStatusClass(r.status)}`}>{runStatusLabel(r.status)}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(r.startedAt))}</td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{r.finishedAt ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(r.finishedAt)) : '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--danger)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.errorMessage ?? '—'}</td>
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
