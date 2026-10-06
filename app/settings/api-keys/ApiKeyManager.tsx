'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, KeyRound, Plus, Trash2, X } from 'lucide-react';

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  environment: string;
  lastUsedAt: string | null;
  createdAt: string;
};

const SCOPE_OPTIONS = ['orders.read', 'orders.write', 'wallet.read', 'wallet.write', 'ai.generate', 'automation.read', 'automation.write'];

export function ApiKeyManager({ initialKeys, workspaceId }: { initialKeys: ApiKey[]; workspaceId: string }) {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScopes, setNewScopes] = useState<string[]>(['orders.read', 'wallet.read']);
  const [newEnv, setNewEnv] = useState<'live' | 'test'>('test');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) { setError('نام کلید الزامی است'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/b2b/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), scopes: newScopes, environment: newEnv, workspaceId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: { message?: string } }).error?.message ?? 'خطا در ایجاد کلید');
        return;
      }
      const data = await res.json() as { key: string; keyPrefix?: string; id?: string };
      setCreatedKey(data.key);
      setCreating(false);
      setNewName('');
      router.refresh();
    } catch {
      setError('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(keyId: string) {
    if (!confirm('این کلید API حذف شده و قابل بازیابی نیست. ادامه می‌دهید؟')) return;
    setDeletingId(keyId);
    try {
      const res = await fetch('/api/v1/b2b/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId, workspaceId }),
      });
      if (res.ok) {
        setKeys(prev => prev.filter(k => k.id !== keyId));
      }
    } finally {
      setDeletingId(null);
    }
  }

  function toggleScope(scope: string) {
    setNewScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]);
  }

  return (
    <>
      {createdKey && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--success)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--success)' }}>کلید API ساخته شد — یک بار نمایش داده می‌شود</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', wordBreak: 'break-all' }}>{createdKey}</code>
            <button
              type="button"
              style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}
              onClick={() => { navigator.clipboard.writeText(createdKey).catch(() => {}); }}
            >
              <Copy size={12}/>
            </button>
            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setCreatedKey(null)}><X size={14}/></button>
          </div>
        </div>
      )}

      {creating ? (
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '16px', marginBottom: 16, border: '1px solid var(--line)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13 }}>کلید API جدید</h3>
          {error && <p style={{ color: 'var(--danger)', fontSize: 11, margin: '0 0 8px' }}>{error}</p>}
          <div className="form-row" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>نام کلید</label>
            <input
              className="input"
              placeholder="مثال: Mobile App"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>محیط</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['live', 'test'] as const).map(e => (
                <button key={e} type="button"
                  style={{ fontSize: 10, padding: '4px 12px', borderRadius: 6, border: `1px solid ${newEnv === e ? 'var(--accent)' : 'var(--line)'}`, background: newEnv === e ? 'var(--accent)' : 'var(--surface-2)', color: newEnv === e ? '#fff' : 'var(--ink)', cursor: 'pointer' }}
                  onClick={() => setNewEnv(e)}
                >{e === 'live' ? 'Live' : 'Test'}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>Scopeها</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SCOPE_OPTIONS.map(s => (
                <button key={s} type="button"
                  style={{ fontSize: 9, padding: '3px 8px', borderRadius: 5, fontFamily: 'monospace', border: `1px solid ${newScopes.includes(s) ? 'var(--accent)' : 'var(--line)'}`, background: newScopes.includes(s) ? 'var(--accent)' : 'var(--surface-2)', color: newScopes.includes(s) ? '#fff' : 'var(--muted)', cursor: 'pointer', direction: 'ltr' }}
                  onClick={() => toggleScope(s)}
                >{s}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button primary" type="button" disabled={loading} onClick={handleCreate}>{loading ? '...' : 'ایجاد کلید'}</button>
            <button className="button secondary" type="button" onClick={() => { setCreating(false); setError(null); }}>انصراف</button>
          </div>
        </div>
      ) : (
        <button className="button primary" type="button" onClick={() => setCreating(true)} style={{ marginBottom: 16 }}>
          <Plus size={15}/>کلید جدید
        </button>
      )}

      {keys.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
          <KeyRound size={24} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }}/>
          هنوز کلید API ایجاد نشده است.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
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
                  <button
                    aria-label="حذف کلید"
                    disabled={deletingId === k.id}
                    style={{ background: 'none', color: 'var(--danger)', height: 34, width: 34, border: '1px solid rgba(255,113,135,.3)', borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                    onClick={() => handleDelete(k.id)}
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
