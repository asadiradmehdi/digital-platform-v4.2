import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, Bot, GitBranch, Play, Plus, Webhook } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { ProductCard, SystemStrip } from '../../components/ProductSurface';
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

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <span className="eyebrow">AUTOMATION ENGINE / WORKFLOWS</span>
            <h1>اتوماسیون</h1>
            <p>Trigger، شرط، Action، Delay و Webhook را به Workflowهای نسخه‌دار و قابل ردیابی تبدیل کن.</p>
          </div>
          <Link className="button primary" href="/automation/new"><Plus size={15}/>ساخت Workflow</Link>
        </header>
        <SystemStrip/>

        {workflows.length > 0 ? (
          <article className="surface-panel data-panel" style={{ marginBottom: 20 }}>
            <div className="panel-head" style={{ marginBottom: 14 }}>
              <div><span className="panel-kicker">WORKFLOWS</span><h2>Workflow‌های فعال</h2></div>
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
                    <td><strong>{w.name}</strong></td>
                    <td><span className="text-ltr" style={{ fontSize: 11 }}>v{w.version ?? 1}</span></td>
                    <td>
                      <span className={`status-pill ${w.active ? 'success' : 'warning'}`}>
                        {w.active ? 'فعال' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 10 }}>
                      {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(w.createdAt))}
                    </td>
                    <td>
                      <Link
                        href={`/automation/${w.id}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 11, textDecoration: 'none' }}
                      >
                        <Activity size={13}/>جزئیات
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ) : null}

        <section className="product-card-grid-premium">
          <ProductCard icon={Play} title="Workflow Builder" description="ساخت بصری جریان اجرا با نسخه‌بندی و run history." meta="Draft · Published · Versioned"/>
          <ProductCard icon={Webhook} title="Triggers & Webhooks" description="شروع فرآیند از رویداد، زمان‌بندی یا Webhook امن." meta="Signed · Idempotent · Audited"/>
          <ProductCard icon={Bot} title="AI Agents" description="Agentهای دارای ابزار و policy با ثبت تمام side effectها." meta="Policy controlled · Audited"/>
          <ProductCard icon={GitBranch} title="Conditions" description="Branching، guardها و کنترل خطا برای مسیرهای پیچیده." meta="Deterministic · Observable"/>
        </section>
      </main>
    </AppShell>
  );
}
