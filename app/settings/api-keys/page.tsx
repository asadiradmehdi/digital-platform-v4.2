import Link from 'next/link';
import { ArrowRight, Copy, Eye, KeyRound, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
export const metadata = { title: 'API و دسترسی‌ها', robots: { index: false, follow: false } };
const keys = [
  { id: 'k1', name: 'Production Integration', prefix: 'dp_live_', env: 'live', scopes: ['read:orders', 'write:orders', 'read:wallet'], created: '۱ مهر ۱۴۰۵', lastUsed: '۲ دقیقه پیش' },
  { id: 'k2', name: 'Test Environment', prefix: 'dp_test_', env: 'test', scopes: ['read:orders', 'write:orders'], created: '۱۵ شهریور ۱۴۰۵', lastUsed: '۱ روز پیش' },
];
export default function ApiKeysSettings() {
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
            <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
              {keys.map(k => (
                <div key={k.id} className="api-key-row">
                  <div className="api-key-icon"><KeyRound size={16}/></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontSize: 12 }}>{k.name}</b>
                      <span className={`status-pill ${k.env === 'live' ? 'success' : 'info'}`} style={{ fontSize: 9 }}>{k.env === 'live' ? 'Live' : 'Test'}</span>
                    </div>
                    <code style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginTop: 4, fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{k.prefix}••••••••••••••••</code>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                      {k.scopes.map(s => <span key={s} style={{ fontSize: 9, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 7px', fontFamily: 'monospace', direction: 'ltr' }}>{s}</span>)}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--muted)' }}>ساخته‌شده: {k.created} · آخرین استفاده: {k.lastUsed}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <button aria-label="نمایش کلید" style={{ background: 'none', color: 'var(--muted)', height: 34, width: 34, border: '1px solid var(--line)', borderRadius: 8, display: 'grid', placeItems: 'center' }}><Eye size={14}/></button>
                    <button aria-label="کپی کلید" style={{ background: 'none', color: 'var(--muted)', height: 34, width: 34, border: '1px solid var(--line)', borderRadius: 8, display: 'grid', placeItems: 'center' }}><Copy size={14}/></button>
                    <button aria-label="حذف کلید" style={{ background: 'none', color: 'var(--danger)', height: 34, width: 34, border: '1px solid rgba(255,113,135,.3)', borderRadius: 8, display: 'grid', placeItems: 'center' }}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
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
            <Link className="button secondary" style={{ marginTop: 14 }} href="/api/v1/b2b/api-keys">مستندات B2B API</Link>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
