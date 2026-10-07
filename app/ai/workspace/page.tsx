import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, History, LayoutGrid } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import AIComposer from './AIComposer';

export const metadata: Metadata = { title: 'محیط هوش مصنوعی', robots: { index: false, follow: false } };

export default function AIWorkspace() {
  return (
    <AppShell>
      <main className="workspace-page-content">
        <div className="ai-workspace-shell">
          <header className="ai-workspace-head">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Link
                  href="/ai"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    color: 'var(--muted)',
                    textDecoration: 'none',
                  }}
                >
                  <ChevronLeft size={13} />
                  هوش مصنوعی
                </Link>
                <span style={{ fontSize: 11, color: 'var(--subtle)' }}>/</span>
                <span style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600 }}>محیط اجرا</span>
              </div>
              <h1 style={{ fontSize: 'clamp(26px,3vw,36px)', letterSpacing: '-.04em', margin: 0, lineHeight: 1.2 }}>
                مسئله را وارد کن.
              </h1>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 11 }}>
                مدل، context، فایل‌ها و مصرف در همین محیط کنترل می‌شوند.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Link
                className="button secondary"
                href="/ai"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <LayoutGrid size={14} />
                همه مدل‌ها
              </Link>
              <button
                type="button"
                className="button secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'not-allowed', opacity: 0.6 }}
                disabled
                aria-label="تاریخچه مکالمات — به‌زودی"
                title="به‌زودی"
              >
                <History size={14} />
                تاریخچه
              </button>
            </div>
          </header>

          <AIComposer />
        </div>
      </main>
    </AppShell>
  );
}
