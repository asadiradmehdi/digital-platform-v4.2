import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
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
              <span className="eyebrow">هوش مصنوعی · محیط اجرا</span>
              <h1>مسئله را وارد کن.</h1>
              <p>مدل، context، فایل‌ها و مصرف در همین محیط کنترل می‌شوند.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link className="button secondary" href="/ai"><Plus size={15} />پروژه جدید</Link>
              <Link className="button secondary" href="/ai">همه پروژه‌ها</Link>
            </div>
          </header>
          <AIComposer />
        </div>
      </main>
    </AppShell>
  );
}
