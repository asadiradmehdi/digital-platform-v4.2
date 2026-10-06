import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { query, withWorkspaceTransaction } from '../../../server/core/db';
import { ApiKeyManager } from './ApiKeyManager';

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
          <Link className="button secondary" href="/settings"><ArrowRight size={15}/>تنظیمات</Link>
        </header>
        <SystemStrip/>
        <div className="settings-layout">
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">ACTIVE KEYS</span><h2>کلیدهای فعال</h2></div></div>
            <div style={{ marginTop: 8 }}>
              <ApiKeyManager initialKeys={keys} workspaceId={workspaceId ?? ''} />
            </div>
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
