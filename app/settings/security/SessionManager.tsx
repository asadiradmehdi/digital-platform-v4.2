'use client';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Laptop2, Loader2, LogOut, Smartphone, X } from 'lucide-react';

/** One signed-in device (web or app session). Token hashes never reach the browser. */
interface Session {
  id: string;
  clientType: string | null;
  isCurrent: boolean;
  label: string;
  method: string | null;
  lastSeen: string;
  expires: string;
}

export default function SessionManager({ sessions }: { sessions: Session[] }) {
  const [list, setList] = useState(sessions);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [allRevoked, setAllRevoked] = useState(false);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revokeOne = async (sessionId: string) => {
    setRevoking(sessionId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Origin': window.location.origin },
      });
      // 404: already signed out elsewhere — the row goes away either way.
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      setList(prev => prev.filter(s => s.id !== sessionId));
    } catch { setError('خروج از این دستگاه انجام نشد. دوباره تلاش کنید.'); } finally {
      setRevoking(null);
    }
  };

  const revokeAll = async () => {
    setRevokingAll(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/sessions', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Origin': window.location.origin },
      });
      if (!res.ok) throw new Error(String(res.status));
      setList(prev => prev.filter(s => s.isCurrent));
      setAllRevoked(true);
    } catch { setError('خروج از دستگاه‌های دیگر انجام نشد. دوباره تلاش کنید.'); } finally {
      setRevokingAll(false);
    }
  };

  if (list.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0' }}>
        نشست فعالی یافت نشد.
      </p>
    );
  }

  return (
    <>
      <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
        {list.map(s => {
          const isMobile = s.clientType === 'IOS' || s.clientType === 'ANDROID' || /iOS|Android/.test(s.label);
          const Icon = isMobile ? Smartphone : Laptop2;
          return (
            <div key={s.id} className="session-row">
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: s.isCurrent ? 'var(--accent-soft)' : 'var(--surface-3)',
                  color: s.isCurrent ? 'var(--accent)' : 'var(--muted)',
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                }}
              >
                <Icon size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b style={{ fontSize: 13, color: 'var(--ink)' }}>{s.label}</b>
                  {s.isCurrent && (
                    <span className="status-pill success" style={{ fontSize: 11 }}>
                      این دستگاه
                    </span>
                  )}
                </div>
                <small
                  style={{
                    display: 'block',
                    color: 'var(--subtle)',
                    fontSize: 11,
                    marginTop: 3,
                  }}
                >
                  {s.method ? `${s.method} · ` : ''}آخرین فعالیت: {s.lastSeen}
                </small>
                <small style={{ display: 'block', color: 'var(--subtle)', fontSize: 10.5, marginTop: 2 }}>
                  اعتبار تا {s.expires}
                </small>
              </div>
              {s.isCurrent ? (
                <CheckCircle2 size={16} style={{ color: 'var(--success)', flex: 'none' }} />
              ) : (
                <button
                  className="button secondary"
                  style={{ padding: '0 14px', height: 34, fontSize: 11, gap: 6, flex: 'none' }}
                  type="button"
                  disabled={revoking === s.id}
                  onClick={() => void revokeOne(s.id)}
                >
                  {revoking === s.id ? (
                    <Loader2 size={12} className="spin-icon" />
                  ) : (
                    <LogOut size={13} />
                  )}
                  خروج
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="auth-error" role="alert" style={{ marginTop: 12 }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {list.length > 1 && !allRevoked && !confirmRevokeAll && (
        <button
          className="button danger"
          style={{ marginTop: 16, width: '100%' }}
          type="button"
          disabled={revokingAll}
          onClick={() => setConfirmRevokeAll(true)}
        >
          خروج از همه دستگاه‌ها به جز این
        </button>
      )}

      {confirmRevokeAll && !allRevoked && (
        <div
          style={{
            marginTop: 16,
            padding: '16px 18px',
            background: 'var(--warning-soft)',
            border: '1px solid rgba(217,119,6,.22)',
            borderRadius: 13,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 14 }}>
            <AlertTriangle size={16} style={{ color: 'var(--warning)', flex: 'none', marginTop: 1 }} />
            <div>
              <strong style={{ display: 'block', fontSize: 13, color: 'var(--ink)', marginBottom: 3 }}>
                خروج از همه دستگاه‌ها
              </strong>
              <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
                تمام نشست‌های فعال به جز دستگاه جاری فوراً بسته می‌شوند. این عمل قابل بازگشت نیست.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setConfirmRevokeAll(false)}
              style={{ background: 'none', color: 'var(--subtle)', display: 'flex', padding: 2, flex: 'none', marginTop: -2 }}
              aria-label="انصراف"
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="button danger"
              type="button"
              disabled={revokingAll}
              onClick={() => { setConfirmRevokeAll(false); void revokeAll(); }}
            >
              {revokingAll ? (
                <>
                  <Loader2 size={14} className="spin-icon" />
                  در حال خروج...
                </>
              ) : (
                'تأیید و خروج'
              )}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => setConfirmRevokeAll(false)}
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {allRevoked && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            padding: '10px 14px',
            background: 'var(--success-soft)',
            borderRadius: 10,
            fontSize: 12,
            color: 'var(--success)',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={14} />
          همه نشست‌های دیگر با موفقیت خاتمه یافتند.
        </div>
      )}
    </>
  );
}
