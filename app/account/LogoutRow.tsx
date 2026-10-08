'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ZIcon } from '../../components/zp/ZIcon';
import { Tile } from '../../components/zp/brand';

export function LogoutRow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const logout = async () => {
    setBusy(true); setFailed(false);
    try {
      const res = await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) throw new Error();
      router.replace('/auth');
      router.refresh();
    } catch {
      setFailed(true); setBusy(false);
    }
  };
  return (
    <button type="button" className="zp-mrow zp-press" onClick={logout} disabled={busy}>
      <Tile icon="out" danger />
      <span className="lb">{busy ? 'در حال خروج…' : 'خروج از حساب'}</span>
      {failed && <small style={{ color: 'var(--danger)' }}>دوباره تلاش کنید</small>}
      <ZIcon name="chevL" className="zp-chev" />
    </button>
  );
}
