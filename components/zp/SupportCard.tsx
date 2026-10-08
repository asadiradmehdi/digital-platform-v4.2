// Contact card for /support: every number is a big tel: link; without numbers the card still reads complete
// (hours + ticket CTA) and never shows placeholder digits. Server component.
import Link from 'next/link';
import { Ornament, Tile } from './brand';
import { ZIcon } from './ZIcon';
import type { SupportContact } from '../../server/content/trust';

export function SupportCard({ contact }: { contact: SupportContact }) {
  const { phones, hours } = contact;
  return (
    <section className="zp-sup" aria-labelledby="sup-title">
      <Ornament id="sup-orn" w={400} h={phones.length ? 260 : 200} cx={360} cy={30} rot={-14} color="#f2d390" alpha={0.5} />
      <div className="h">
        <Tile icon="chat" gold />
        <div>
          <b id="sup-title">پشتیبانی زُحل پی</b>
          <span><ZIcon name="clock" />{hours}</span>
        </div>
      </div>
      {phones.length ? (
        <div className="zp-tels">
          {phones.map(p => (
            <a key={p.tel} href={`tel:${p.tel}`} className="zp-tel zp-press" aria-label={`تماس با ${p.label}: ${p.display}`}>
              <Tile icon="phone" gold />
              <span className="t"><small>{p.label}</small><b>{p.display}</b></span>
              <em aria-hidden="true">تماس</em>
            </a>
          ))}
        </div>
      ) : (
        <>
          <p>درخواست‌تان را با تیکت ثبت کنید؛ کارشناسان ما در ساعات کاری پاسخ می‌دهند و همه‌ی گفتگو همین‌جا برای پیگیری می‌ماند.</p>
          <Link href="/support/new" className="zp-cta big zp-press">ثبت تیکت جدید</Link>
        </>
      )}
    </section>
  );
}
