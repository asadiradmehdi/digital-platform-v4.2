'use client';
import { useState } from 'react';
import { CheckCircle2, Laptop2, LogOut, Smartphone } from 'lucide-react';

interface Session {
  id: string;
  tokenHash: string;
  clientType: string | null;
  deviceName: string | null;
  lastUserAgent: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  isCurrent: boolean;
  label: string;
  lastSeen: string;
}

export default function SessionManager({ sessions }: { sessions: Session[] }) {
  const [list, setList] = useState(sessions);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [allRevoked, setAllRevoked] = useState(false);

  const revokeOne = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await fetch(`/api/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Origin': window.location.origin },
      });
      setList(prev => prev.filter(s => s.id !== sessionId));
    } catch { /* silently ignore */ } finally {
      setRevoking(null);
    }
  };

  const revokeAll = async () => {
    setRevokingAll(true);
    try {
      await fetch('/api/v1/auth/sessions', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Origin': window.location.origin },
      });
      setList(prev => prev.filter(s => s.isCurrent));
      setAllRevoked(true);
    } catch { /* silently ignore */ } finally {
      setRevokingAll(false);
    }
  };

  return (
    <>
      <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
        {list.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>نشست فعالی یافت نشد.</p>
        ) : (
          list.map(s => {
            const Icon = /iPhone|iPad|Android/.test(s.lastUserAgent ?? '') || s.clientType === 'IOS' || s.clientType === 'ANDROID' ? Smartphone : Laptop2;
            return (
              <div key={s.id} className="session-row">
                <span className="session-icon"><Icon size={17}/></span>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 12 }}>{s.label}</b>
                  <small style={{ display: 'block', color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>
                    آخرین فعالیت: {s.lastSeen}
                  </small>
                </div>
                {s.isCurrent
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--success)' }}><CheckCircle2 size={13}/>این دستگاه</span>
                  : <button
                      className="button secondary"
                      style={{ padding: '0 12px', height: 32, fontSize: 10 }}
                      type="button"
                      disabled={revoking === s.id}
                      onClick={() => void revokeOne(s.id)}
                    >
                      <LogOut size={12}/>{revoking === s.id ? '...' : 'خروج'}
                    </button>
                }
              </div>
            );
          })
        )}
      </div>
      {list.length > 1 && !allRevoked && (
        <button
          className="button danger"
          style={{ marginTop: 16, width: '100%' }}
          type="button"
          disabled={revokingAll}
          onClick={() => void revokeAll()}
        >
          {revokingAll ? 'در حال خروج...' : 'خروج از همه دستگاه‌ها به جز این'}
        </button>
      )}
      {allRevoked && (
        <p style={{ fontSize: 11, color: 'var(--success)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          <CheckCircle2 size={13}/>همه نشست‌های دیگر خاتمه یافت.
        </p>
      )}
    </>
  );
}
