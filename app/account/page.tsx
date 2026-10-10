import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { ShellAside } from '../../components/zp/ShellAside';
import { Ornament, Tile } from '../../components/zp/brand';
import { ZIcon, type IconName } from '../../components/zp/ZIcon';
import { formatQuantityWords } from '../../lib/format';
import { tierFor } from '../../lib/tiers';
import { requireViewer } from '../../server/account/page-context';
import { getAccountStats, hasEnabledMfa } from '../../server/account/overview';
import { LogoutRow } from './LogoutRow';

export const metadata: Metadata = { title: 'حساب من', robots: { index: false, follow: false } };

const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

export default async function Account() {
  const viewer = await requireViewer();
  const [stats, mfa] = await Promise.all([
    viewer.workspaceId ? getAccountStats(viewer.workspaceId) : { totalOrders: 0, activeOrders: 0, spentToman: 0 },
    hasEnabledMfa(viewer.userId).catch(() => false),
  ]);
  const t = tierFor(stats.spentToman);
  const contact = viewer.phone ?? viewer.email ?? '';

  const rows: Array<{ href: string; icon: IconName; label: string; note?: string; tag?: boolean }> = [
    { href: '/invite', icon: 'gift', label: 'دعوت از دوستان', note: 'از هر خرید دوستانتان سهم بگیرید' },
    { href: '/invoices', icon: 'doc', label: 'فاکتورها', note: 'فاکتور خرید و رسید شارژ' },
    { href: '/settings/profile', icon: 'userCard', label: 'اطلاعات حساب', note: 'نام، شماره و ایمیل' },
    { href: '/settings/security', icon: 'shield', label: 'امنیت و ورود', note: mfa ? 'ورود دومرحله‌ای فعال' : 'فعال‌سازی ورود دومرحله‌ای', tag: mfa },
    { href: '/settings/notifications', icon: 'bell', label: 'اعلان‌ها', note: 'وضعیت سفارش و پیشنهادها' },
    { href: '/support', icon: 'chat', label: 'پشتیبانی', note: 'تیکت و تماس تلفنی' },
    { href: '/licenses', icon: 'cert', label: 'مجوزها و نمادها', note: 'اینماد و ساماندهی' },
  ];

  return (
    <AppShell aside={<ShellAside workspaceId={viewer.workspaceId} />}>
      <main className="zp-screen">
        <div className="zp-prof">
          <span className="zp-av" aria-hidden="true">{viewer.displayName.slice(0, 1)}</span>
          <div className="t"><b>{viewer.displayName}</b>{contact && <span className="zp-ltr">{contact}</span>}</div>
          <Link href="/settings/profile" className="zp-ibtn zp-press" aria-label="ویرایش اطلاعات"><ZIcon name="edit" /></Link>
        </div>

        <div className="zp-tiercard">
          <Ornament id="tier-orn" w={400} h={130} cx={60} cy={140} rot={12} color="#7a5218" alpha={0.5} />
          <div className="h">
            <Tile icon="shamseh" />
            <div><b>سطح {t.tier.name}</b><span>بر اساس مجموع خریدهای پرداخت‌شده شما</span></div>
            <em>سطح {fa(t.level)} از {fa(t.levels)}</em>
          </div>
          <div className="zp-pm">
            <div className="zp-prog"><i style={{ transform: `scaleX(${t.progress})` }} /></div>
            <span>{t.next ? `${formatQuantityWords(t.remainingToman)} تومان خرید دیگر تا سطح ${t.next.name}` : 'بالاترین سطح'}</span>
          </div>
        </div>

        <div className="zp-stats">
          <div><b>{fa(stats.totalOrders)}</b><span>کل سفارش‌ها</span></div>
          <div><b>{fa(stats.activeOrders)}</b><span>در حال انجام</span></div>
          <div><b>{stats.spentToman ? formatQuantityWords(stats.spentToman) : '۰'}</b><span>خرید کل (تومان)</span></div>
        </div>

        <div className="zp-setl">
          {rows.map(r => (
            <Link key={r.href} href={r.href} className="zp-mrow zp-press">
              <Tile icon={r.icon} />
              <span className="lb">{r.label}</span>
              {r.note && <small className={r.tag ? 'tag' : undefined}>{r.note}</small>}
              <ZIcon name="chevL" className="zp-chev" />
            </Link>
          ))}
          <LogoutRow />
        </div>
      </main>
    </AppShell>
  );
}
