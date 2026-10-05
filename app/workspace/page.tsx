import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, Plus, Settings2, Sparkles, Users } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
export const metadata: Metadata = { title: 'Workspace', robots: { index: false, follow: false } };
const workspaces = [
  { id: 'ws-1', name: 'فضای کاری اصلی', slug: 'main', members: 1, active: true },
];
export default function WorkspacePage() {
  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div><span className="eyebrow">WORKSPACE</span><h1>Workspaceها</h1><p>هر Workspace یک محیط جداگانه با wallet، اشتراک، سفارش و تنظیمات مستقل دارد.</p></div>
          <button className="button primary" type="button"><Plus size={15}/>Workspace جدید</button>
        </header>
        <SystemStrip/>
        <div style={{ display: 'grid', gap: 14, maxWidth: 680 }}>
          {workspaces.map(ws => (
            <article key={ws.id} className="surface-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--accent-strong)', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 800, flex: 'none' }}>
                  {ws.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 14 }}>{ws.name}</b>
                    {ws.active && <span className="status-pill success" style={{ fontSize: 9 }}>فعال</span>}
                    <code style={{ fontSize: 10, color: 'var(--muted)', marginInlineStart: 'auto', direction: 'ltr' }}>{ws.slug}</code>
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12}/>{ws.members} عضو</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Sparkles size={12}/>Pro</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Link href="/settings" aria-label="تنظیمات" style={{ width: 36, height: 36, border: '1px solid var(--line)', borderRadius: 10, display: 'grid', placeItems: 'center', color: 'var(--muted)' }}><Settings2 size={15}/></Link>
                  <Link href="/dashboard" style={{ height: 36, padding: '0 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink)' }}>باز کردن<ChevronLeft size={14}/></Link>
                </div>
              </div>
            </article>
          ))}
          <button type="button" className="ws-new-btn">
            <Plus size={18}/><span>ساخت Workspace جدید</span>
          </button>
        </div>
      </main>
    </AppShell>
  );
}
