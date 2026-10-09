'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

export function CreateWorkspaceButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) { setError('نام workspace الزامی است'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: { message?: string } }).error?.message ?? 'خطا در ایجاد workspace');
        return;
      }
      setOpen(false);
      setName('');
      router.refresh();
    } catch {
      setError('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="button primary" type="button" onClick={() => setOpen(true)}>
        <Plus size={15}/>فضای کاری جدید
      </button>
    );
  }

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>فضای کاری جدید</span>
        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => { setOpen(false); setError(null); }}><X size={14}/></button>
      </div>
      {error && <p style={{ margin: 0, fontSize: 11, color: 'var(--danger)' }}>{error}</p>}
      <input
        className="input"
        placeholder="نام workspace"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleCreate()}
        autoFocus
      />
      <button className="button primary" type="button" disabled={loading} onClick={handleCreate} style={{ width: '100%' }}>
        {loading ? '...' : 'ایجاد'}
      </button>
    </div>
  );
}
