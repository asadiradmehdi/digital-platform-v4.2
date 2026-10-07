import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, Settings2, Sparkles, Users } from 'lucide-react';
import { CreateWorkspaceButton } from './CreateWorkspaceButton';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { requireCurrentUser } from '../../server/identity/request-user';
import { query } from '../../server/core/db';

export const metadata: Metadata = { title: 'Workspace', robots: { index: false, follow: false } };

export default async function WorkspacePage() {
  let userId: string;
  try {
    userId = await requireCurrentUser();
  } catch {
    redirect('/auth');
  }

  const result = await query<{
    workspace_id: string;
    workspace_name: string;
    workspace_slug: string;
    member_count: string;
    plan_name: string | null;
    sub_status: string | null;
  }>(
    `SELECT wm.workspace_id,
            w.name AS workspace_name,
            w.slug AS workspace_slug,
            (SELECT COUNT(*) FROM workspace_members wm2 WHERE wm2.workspace_id=wm.workspace_id AND wm2.status='ACTIVE') AS member_count,
            p.name AS plan_name,
            s.status AS sub_status
     FROM workspace_members wm
     JOIN workspaces w ON w.id=wm.workspace_id
     LEFT JOIN subscriptions s ON s.workspace_id=wm.workspace_id AND s.status IN ('ACTIVE','TRIALING')
     LEFT JOIN plans p ON p.id=s.plan_id
     WHERE wm.user_id=$1 AND wm.status='ACTIVE'
     ORDER BY wm.created_at`,
    [userId],
  );
  const workspaces = result.rows;

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div><span className="eyebrow">WORKSPACE</span><h1>Workspaceها</h1><p>هر Workspace یک محیط جداگانه با wallet، اشتراک، سفارش و تنظیمات مستقل دارد.</p></div>
          <CreateWorkspaceButton/>
        </header>
        <SystemStrip/>
        <div style={{ display: 'grid', gap: 14, maxWidth: 680 }}>
          {workspaces.map(ws => (
            <article key={ws.workspace_id} className="surface-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--accent-strong)', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 800, flex: 'none' }}>
                  {ws.workspace_name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 14 }}>{ws.workspace_name}</b>
                    {ws.sub_status && (
                      <span className={`status-pill ${ws.sub_status === 'ACTIVE' || ws.sub_status === 'TRIALING' ? 'success' : 'warning'}`} style={{ fontSize: 11 }}>
                        {ws.sub_status === 'ACTIVE' ? 'فعال' : ws.sub_status === 'TRIALING' ? 'آزمایشی' : ws.sub_status}
                      </span>
                    )}
                    <code style={{ fontSize: 10, color: 'var(--muted)', marginInlineStart: 'auto', direction: 'ltr' }}>{ws.workspace_slug}</code>
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12}/>{ws.member_count} عضو</span>
                    {ws.plan_name && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Sparkles size={12}/>{ws.plan_name}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Link href="/settings" aria-label="تنظیمات" style={{ width: 36, height: 36, border: '1px solid var(--line)', borderRadius: 10, display: 'grid', placeItems: 'center', color: 'var(--muted)' }}><Settings2 size={15}/></Link>
                  <Link href="/dashboard" style={{ height: 36, padding: '0 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink)' }}>باز کردن<ChevronLeft size={14}/></Link>
                </div>
              </div>
            </article>
          ))}
          {workspaces.length === 0 && (
            <article className="surface-panel" style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>هنوز Workspace‌ای ندارید.</p>
            </article>
          )}
          <div className="ws-new-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreateWorkspaceButton/>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
