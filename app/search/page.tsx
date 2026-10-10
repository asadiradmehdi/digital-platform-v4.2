import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { ShellAside } from '../../components/zp/ShellAside';
import { optionalViewer } from '../../server/account/page-context';
import { SearchClient } from './SearchClient';

export const metadata: Metadata = { title: 'جستجو', robots: { index: false, follow: false } };

export default async function SearchPage() {
  const viewer = await optionalViewer();
  if (!viewer) redirect('/auth?next=/search');
  return (
    <AppShell title="جستجو" back="/dashboard" aside={<ShellAside workspaceId={viewer.workspaceId} />}>
      <main className="zp-screen"><SearchClient /></main>
    </AppShell>
  );
}
