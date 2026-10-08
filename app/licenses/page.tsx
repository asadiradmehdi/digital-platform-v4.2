import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { ShellAside } from '../../components/zp/ShellAside';
import { Tile } from '../../components/zp/brand';
import { ZIcon } from '../../components/zp/ZIcon';
import { optionalViewer } from '../../server/account/page-context';
import { licensesView } from '../../server/content/trust';

export const metadata: Metadata = { title: 'مجوزها و نمادها', description: 'مجوزها و نمادهای اعتماد زُحل پی.' };

export default async function LicensesPage() {
  const viewer = await optionalViewer();
  const licenses = licensesView();
  return (
    <AppShell title="مجوزها و نمادها" aside={viewer ? <ShellAside workspaceId={viewer.workspaceId} /> : undefined}>
      <main className="zp-screen">
        <div className="zp-hero">
          <Tile icon="cert" />
          <div>
            <h1>مجوزها و نمادهای اعتماد</h1>
            <p>هر مجوز فقط وقتی «فعال» نشان داده می‌شود که از سایت رسمی صادرکننده قابل استعلام باشد.</p>
          </div>
        </div>
        <ul className="zp-lic" aria-label="مجوزها">
          {licenses.map(l => (
            <li key={l.key} className="zp-licard">
              <Tile icon={l.icon} />
              <div className="t">
                <b>{l.title}</b>
                <span>{l.issuer}</span>
                <p>{l.text}</p>
              </div>
              <div className="s">
                <span className={`zp-st${l.status === 'active' ? ' ok' : ''}`}>{l.status === 'active' ? 'فعال' : 'در حال اخذ'}</span>
                {l.verifyUrl && <a href={l.verifyUrl} target="_blank" rel="noopener noreferrer" className="zp-verify">استعلام<ZIcon name="chevL" /></a>}
              </div>
            </li>
          ))}
        </ul>
        <nav className="zp-lic-links" aria-label="قوانین">
          <Link href="/terms" className="zp-mrow zp-press"><Tile icon="doc" /><span className="lb">قوانین و مقررات</span><ZIcon name="chevL" className="zp-chev" /></Link>
          <Link href="/privacy" className="zp-mrow zp-press"><Tile icon="shieldS" /><span className="lb">حریم خصوصی</span><ZIcon name="chevL" className="zp-chev" /></Link>
        </nav>
      </main>
    </AppShell>
  );
}
