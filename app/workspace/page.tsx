import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Workspace', robots: { index: false, follow: false } };
export default function Page(){ return <main className="public-shell"><section className="public-info-card"><h1>Workspace</h1><p>محیط خصوصی کاربر.</p></section></main>; }
