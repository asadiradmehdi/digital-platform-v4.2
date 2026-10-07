'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Copy, KeyRound, Loader2, Plus, Trash2, X } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);
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

  async function handleCopy() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* Newly created key reveal banner */}
      {createdKey && (
        <div
          style={{
            background: 'var(--success-soft)',
            border: '1px solid rgba(22,163,74,.2)',
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 20,
          }}
          role="alert"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--success)',
              }}
            >
              <CheckCircle2 size={14} />
              کلید API ساخته شد — فقط یک بار نمایش داده می‌شود
            </span>
            <button
              type="button"
              onClick={() => setCreatedKey(null)}
              style={{ background: 'none', color: 'var(--subtle)', display: 'flex', padding: 2 }}
              aria-label="بستن"
            >
              <X size={14} />
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: 9,
              padding: '10px 14px',
            }}
          >
            <code
              style={{
                flex: 1,
                fontSize: 12,
                fontFamily: 'var(--font-latin), monospace',
                direction: 'ltr',
                wordBreak: 'break-all',
                color: 'var(--ink)',
              }}
            >
              {createdKey}
            </code>
            <button
              type="button"
              onClick={() => void handleCopy()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                background: copied ? 'var(--success-soft)' : 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 7,
                fontSize: 11,
                color: copied ? 'var(--success)' : 'var(--ink)',
                cursor: 'pointer',
                flex: 'none',
              }}
              aria-label="کپی کلید"
            >
              {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              {copied ? 'کپی شد' : 'کپی'}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {creating ? (
        <div
          style={{
            background: 'var(--surface-2)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 20,
            border: '1px solid var(--line)',
          }}
        >
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>کلید API جدید</h3>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 12px',
                background: 'var(--danger-soft)',
                border: '1px solid rgba(220,38,38,.18)',
                borderRadius: 9,
                fontSize: 12,
                color: 'var(--danger)',
                marginBottom: 14,
              }}
              role="alert"
            >
              <AlertCircle size={13} style={{ flex: 'none' }} />
              {error}
            </div>
          )}

          <div className="settings-form" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'grid', gap: 7 }}>
              نام کلید
              <input
                style={{
                  padding: '10px 13px',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  fontSize: 13,
                  background: '#fff',
                }}
                placeholder="مثال: Mobile App Production"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </label>

            <div>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700 }}>محیط</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['live', 'test'] as const).map(e => (
                  <button
                    key={e}
                    type="button"
                    style={{
                      fontSize: 12,
                      padding: '7px 18px',
                      borderRadius: 8,
                      border: `1px solid ${newEnv === e ? 'var(--accent)' : 'var(--line)'}`,
                      background: newEnv === e ? 'var(--accent)' : '#fff',
                      color: newEnv === e ? '#fff' : 'var(--ink)',
                      cursor: 'pointer',
                      fontWeight: newEnv === e ? 700 : 400,
                      transition: 'all .13s',
                    }}
                    onClick={() => setNewEnv(e)}
                  >
                    {e === 'live' ? '🔴 Live' : '🧪 Test'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700 }}>Scopeها</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SCOPE_OPTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    style={{
                      fontSize: 11,
                      padding: '5px 11px',
                      borderRadius: 7,
                      fontFamily: 'var(--font-latin), monospace',
                      border: `1px solid ${newScopes.includes(s) ? 'var(--accent)' : 'var(--line)'}`,
                      background: newScopes.includes(s) ? 'var(--accent-soft)' : '#fff',
                      color: newScopes.includes(s) ? 'var(--accent-strong)' : 'var(--muted)',
                      cursor: 'pointer',
                      direction: 'ltr',
                      fontWeight: newScopes.includes(s) ? 700 : 400,
                      transition: 'all .13s',
                    }}
                    onClick={() => toggleScope(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="button primary" type="button" disabled={loading} onClick={handleCreate}>
                {loading ? (
                  <>
                    <Loader2 size={14} className="spin-icon" />
                    در حال ایجاد...
                  </>
                ) : (
                  'ایجاد کلید'
                )}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => { setCreating(false); setError(null); }}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          className="button primary"
          type="button"
          onClick={() => setCreating(true)}
          style={{ marginBottom: 20 }}
        >
          <Plus size={15} />
          کلید جدید
        </button>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            background: 'var(--surface-2)',
            borderRadius: 14,
            border: '1px dashed var(--line-strong)',
          }}
        >
          <KeyRound
            size={28}
            style={{ color: 'var(--subtle)', display: 'block', margin: '0 auto 12px' }}
          />
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
            هنوز کلید API ایجاد نشده
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--subtle)' }}>
            کلید بسازید و API را به سرویس‌های خارجی وصل کنید.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {keys.map(k => {
            const created = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(k.createdAt));
            const lastUsed = k.lastUsedAt
              ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(k.lastUsedAt))
              : 'استفاده نشده';
            return (
              <div key={k.id} className="api-key-row">
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: k.environment === 'live' ? 'var(--success-soft)' : 'var(--info-soft)',
                    color: k.environment === 'live' ? 'var(--success)' : 'var(--info)',
                    display: 'grid',
                    placeItems: 'center',
                    flex: 'none',
                  }}
                >
                  <KeyRound size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <b style={{ fontSize: 13, color: 'var(--ink)' }}>{k.name}</b>
                    <span
                      className={`status-pill ${k.environment === 'live' ? 'success' : 'info'}`}
                      style={{ fontSize: 8 }}
                    >
                      {k.environment === 'live' ? 'Live' : 'Test'}
                    </span>
                  </div>
                  <code
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: 'var(--subtle)',
                      fontFamily: 'var(--font-latin), monospace',
                      direction: 'ltr',
                      textAlign: 'right',
                    }}
                  >
                    {k.keyPrefix}••••••••••••••••
                  </code>
                  {k.scopes.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                      {k.scopes.map(s => (
                        <span
                          key={s}
                          style={{
                            fontSize: 9,
                            background: 'var(--surface-3)',
                            border: '1px solid var(--line)',
                            borderRadius: 5,
                            padding: '2px 8px',
                            fontFamily: 'var(--font-latin), monospace',
                            direction: 'ltr',
                            color: 'var(--muted)',
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <p style={{ margin: '7px 0 0', fontSize: 10, color: 'var(--subtle)' }}>
                    ساخته‌شده: {created} · آخرین استفاده: {lastUsed}
                  </p>
                </div>
                <button
                  aria-label="حذف کلید"
                  disabled={deletingId === k.id}
                  style={{
                    background: 'none',
                    color: deletingId === k.id ? 'var(--subtle)' : 'var(--danger)',
                    height: 36,
                    width: 36,
                    border: '1px solid rgba(220,38,38,.2)',
                    borderRadius: 9,
                    display: 'grid',
                    placeItems: 'center',
                    cursor: deletingId === k.id ? 'not-allowed' : 'pointer',
                    flex: 'none',
                  }}
                  onClick={() => void handleDelete(k.id)}
                >
                  {deletingId === k.id ? <Loader2 size={14} className="spin-icon" /> : <Trash2 size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
