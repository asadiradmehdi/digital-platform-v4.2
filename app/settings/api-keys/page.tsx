import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Copy, Eye, KeyRound, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { query, withWorkspaceTransaction } from '../../../server/core/db';

export const metadata: Metadata = { title: 'API و دسترسی‌ها', robots: { index: false, follow: false } };

async function getApiKeys(workspaceId: string) {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const r = await client.query<{
      id: string; name: string; keyPrefix: string; scopes: string[]; environment: string;
      lastUsedAt: string | null; createdAt: string;
    }>(
      `SELECT id, name, key_prefix AS "keyPrefix", scopes, environment,
              last_used_at AS "lastUsedAt", created_at AS "createdAt"
       FROM api_keys
       WHERE workspace_id=$1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [workspaceId],
    );
    return r.rows;
  });
}

export default async function ApiKeysSettings() {
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
  const keys = workspaceId ? await getApiKeys(workspaceId) : [];

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div><span className="eyebrow">SETTINGS / API KEYS</span><h1>API و دسترسی‌ها</h1><p>کلیدهای API، scopeها و کنترل دسترسی سرویس‌های خارجی به workspace.</p></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link className="button secondary" href="/settings"><ArrowRight size={15}/>تنظیمات</Link>
            <button className="button primary" type="button"><Plus size={15}/>کلید جدید</button>
          </div>
        </header>
        <SystemStrip/>
        <div className="settings-layout">
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">ACTIVE KEYS</span><h2>کلیدهای فعال</h2></div></div>
            {keys.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                <KeyRound size={24} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }}/>
                هنوز کلید API ایجاد نشده است.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
                {keys.map(k => {
                  const created = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(k.createdAt));
                  const lastUsed = k.lastUsedAt
                    ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(k.lastUsedAt))
                    : 'استفاده نشده';
                  return (
                    <div key={k.id} className="api-key-row">
                      <div className="api-key-icon"><KeyRound size={16}/></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <b style={{ fontSize: 12 }}>{k.name}</b>
                          <span className={`status-pill ${k.environment === 'live' ? 'success' : 'info'}`} style={{ fontSize: 9 }}>{k.environment === 'live' ? 'Live' : 'Test'}</span>
                        </div>
                        <code style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginTop: 4, fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{k.keyPrefix}••••••••••••••••</code>
                        {k.scopes.length > 0 && (
                          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                            {k.scopes.map(s => <span key={s} style={{ fontSize: 9, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 7px', fontFamily: 'monospace', direction: 'ltr' }}>{s}</span>)}
                          </div>
                        )}
                        <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--muted)' }}>ساخته‌شده: {created} · آخرین استفاده: {lastUsed}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <button aria-label="نمایش کلید" style={{ background: 'none', color: 'var(--muted)', height: 34, width: 34, border: '1px solid var(--line)', borderRadius: 8, display: 'grid', placeItems: 'center' }}><Eye size={14}/></button>
                        <button aria-label="کپی کلید" style={{ background: 'none', color: 'var(--muted)', height: 34, width: 34, border: '1px solid var(--line)', borderRadius: 8, display: 'grid', placeItems: 'center' }}><Copy size={14}/></button>
                        <button aria-label="حذف کلید" style={{ background: 'none', color: 'var(--danger)', height: 34, width: 34, border: '1px solid rgba(255,113,135,.3)', borderRadius: 8, display: 'grid', placeItems: 'center' }}><Trash2 size={14}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">DOCUMENTATION</span><h2>راهنمای استفاده</h2></div></div>
            <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
              <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.9 }}>کلیدهای Live از پیشوند <code dir="ltr" style={{ fontFamily: 'monospace', color: 'var(--accent-strong)' }}>dp_live_</code> و کلیدهای Test از <code dir="ltr" style={{ fontFamily: 'monospace', color: 'var(--info)' }}>dp_test_</code> استفاده می‌کنند.</p>
              </div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700 }}>نمونه header</p>
                <code style={{ display: 'block', fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'left', lineHeight: 1.9 }}>Authorization: Bearer dp_live_xxxxxxxxxxxx</code>
              </div>
            </div>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
