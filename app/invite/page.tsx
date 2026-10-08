import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AppShell } from '../../components/AppShell';
import { SecHead } from '../../components/zp/cards';
import { Tile } from '../../components/zp/brand';
import { formatTomanNumber, formatWhen } from '../../lib/format';
import { requireViewer } from '../../server/account/page-context';
import { clientFingerprint } from '../../server/core/security-boundary';
import { getReferralOverview, type ReferralOverview } from '../../server/referrals/service';
import { InviteShare } from './InviteShare';

export const metadata: Metadata = { title: 'دعوت از دوستان', robots: { index: false, follow: false } };

const fa = (n: number) => n.toLocaleString('fa-IR', { maximumFractionDigits: 1 });

function Friends({ data }: { data: ReferralOverview }) {
  return (
    <>
      <SecHead title="دوستان شما" note={data.invited ? `${fa(data.invited)} نفر` : undefined} />
      {data.friends.length ? (
        <ul className="zp-list zp-friends" aria-label="دوستان دعوت‌شده">
          {data.friends.map((f, i) => (
            <li key={i} className="zp-mrow">
              <Tile icon="user" soft />
              <span className="lb">{f.name}<small>{formatWhen(f.joinedAt)}</small></span>
              <span className={`zp-st${f.active ? ' ok' : ''}`}>{f.active ? 'فعال' : 'منتظر اولین خرید'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="zp-invite-empty">هنوز کسی با لینک شما عضو نشده. اولین دعوت رو همین حالا بفرستید.</p>
      )}
    </>
  );
}

export default async function InvitePage() {
  const viewer = await requireViewer();
  if (!viewer.workspaceId) {
    return (
      <AppShell title="دعوت از دوستان">
        <main className="zp-screen"><p className="zp-invite-empty">برای این حساب هنوز فضای کاری ساخته نشده است. با پشتیبانی در تماس باشید.</p></main>
      </AppShell>
    );
  }
  const h = await headers();
  const req = new Request('http://local/', { headers: h });
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const data = await getReferralOverview(viewer.workspaceId, viewer.userId, clientFingerprint(req), site);
  const nextPct = data.nextSharePercent;
  const progress = nextPct && data.friendsToNext != null ? data.active / (data.active + data.friendsToNext) : 1;

  return (
    <AppShell title="دعوت از دوستان" aside={<Friends data={data} />}>
      <main className="zp-screen zp-invite-screen">
        <section className="zp-invite" aria-labelledby="invite-title">
          <div className="kick"><Tile icon="gift" gold size={40} /><span>دعوت از دوستان</span></div>
          <h1 id="invite-title">
            از هر خرید دوستانت <b className="zp-gtext">{fa(data.sharePercent)}٪</b> سهم توست
          </h1>
          <p>دوستانت رو به زُحل پی بیار؛ هر بار که خرید کنن یا کیف پولشون رو شارژ کنن، سهمت مستقیم به کیف پولت میاد.</p>
          {nextPct ? (
            <div className="lvl">
              <div className="zp-prog"><i style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} /></div>
              <span>{fa(data.friendsToNext ?? 0)} دوست فعال دیگه تا سهم <b>{fa(nextPct)}٪</b></span>
            </div>
          ) : (
            <div className="lvl"><span>شما در بالاترین سطح دعوت هستید.</span></div>
          )}
        </section>

        <InviteShare code={data.code} link={data.link} welcomePercent={data.welcomePercent} />

        <div className="zp-stats" role="list">
          <div role="listitem"><b>{fa(data.invited)}</b><span>دعوت‌شده</span></div>
          <div role="listitem"><b>{fa(data.active)}</b><span>دوست فعال</span></div>
          <div role="listitem"><b>{formatTomanNumber(data.earnedToman)}</b><span>درآمد شما (تومان)</span></div>
        </div>
        {data.pendingToman > 0 && (
          <p className="zp-invite-pending"><Tile icon="clock" soft size={30} />{formatTomanNumber(data.pendingToman)} تومان در راه کیف پول شماست</p>
        )}

        <ol className="zp-steps" aria-label="روش کار">
          <li><Tile icon="share" soft size={34} /><span>لینک یا کد رو برای دوستت بفرست</span></li>
          <li><Tile icon="gift" soft size={34} /><span>دوستت عضو می‌شه و با اولین خرید {fa(data.welcomePercent)}٪ هدیه می‌گیره</span></li>
          <li><Tile icon="wallet" soft size={34} /><span>از هر خرید یا شارژش، سهم تو به کیف پولت اضافه می‌شه</span></li>
        </ol>

        <div className="zp-invite-friends"><Friends data={data} /></div>
      </main>
    </AppShell>
  );
}
