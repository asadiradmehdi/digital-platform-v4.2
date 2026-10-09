import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
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
          <div>
            <span className="eyebrow">حساب کاربری · API</span>
            <h1>API و دسترسی‌ها</h1>
            <p>برای وصل کردن سایت یا ربات خودتان به زُحل پی، کلید API بسازید. هر کلید را هر وقت خواستید باطل کنید.</p>
          </div>
          <Link className="button secondary" href="/settings">
            <ArrowRight size={15} />
            تنظیمات
          </Link>
        </header>

        <div className="settings-layout">
          {/* Key manager */}
          <article className="surface-panel" style={{ padding: 28 }}>
            <div className="panel-head">
              <div>
                <h2>کلیدهای فعال</h2>
              </div>
            </div>
            <ApiKeyManager initialKeys={keys} workspaceId={workspaceId ?? ''} />
          </article>

          {/* Usage guide */}
          <article className="surface-panel" style={{ padding: 28 }}>
            <div className="panel-head">
              <div>
                <h2>راهنمای استفاده</h2>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
              <div
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  border: '1px solid var(--line)',
                }}
              >
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 2 }}>
                  کلیدهای Live از پیشوند{' '}
                  <code
                    dir="ltr"
                    style={{
                      fontFamily: 'var(--font-latin), monospace',
                      color: 'var(--success)',
                      background: 'var(--success-soft)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  >
                    dp_live_
                  </code>{' '}
                  و کلیدهای Test از{' '}
                  <code
                    dir="ltr"
                    style={{
                      fontFamily: 'var(--font-latin), monospace',
                      color: 'var(--info)',
                      background: 'var(--info-soft)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  >
                    dp_test_
                  </code>{' '}
                  استفاده می‌کنند.
                </p>
              </div>

              <div
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  border: '1px solid var(--line)',
                }}
              >
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>
                  نمونه Authorization header
                </p>
                <code
                  style={{
                    display: 'block',
                    fontSize: 11,
                    color: 'var(--muted)',
                    fontFamily: 'var(--font-latin), monospace',
                    direction: 'ltr',
                    textAlign: 'left',
                    lineHeight: 2,
                    background: '#fff',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '10px 14px',
                  }}
                >
                  Authorization: Bearer dp_live_xxxxxxxxxxxx
                </code>
              </div>
            </div>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
