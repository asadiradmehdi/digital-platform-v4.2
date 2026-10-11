'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ZIcon, type IconName } from './ZIcon';
import { Tile } from './brand';
import './help.css';

const TOUR_KEY = 'dp.tour.done.v1';

const TOPICS: Array<{ icon: IconName; title: string; text: string; href: string }> = [
  { icon: 'grid', title: 'چطور سفارش بدهم؟', text: 'شبکه و نوع خدمت را انتخاب کنید، تعداد و لینک را بدهید.', href: '/services' },
  { icon: 'wallet', title: 'چطور کیف پول را شارژ کنم؟', text: 'مبلغ را بنویسید و از درگاه امن پرداخت کنید.', href: '/wallet' },
  { icon: 'tOrders', title: 'سفارشم به کجا رسید؟', text: 'مرحله‌ی هر سفارش را زنده ببینید.', href: '/orders' },
  { icon: 'doc', title: 'فاکتور و رسید', text: 'فاکتور هر خرید با تاریخ و ساعت ایران اینجاست.', href: '/invoices' },
  { icon: 'gift', title: 'دعوت از دوستان', text: 'کد خودتان را بفرستید و از خریدشان سهم بگیرید.', href: '/invite' },
  { icon: 'shield', title: 'امنیت حساب', text: 'ورود دومرحله‌ای و تغییر رمز عبور.', href: '/security' },
  { icon: 'chat', title: 'با پشتیبانی حرف بزنم', text: 'تیکت بزنید یا تماس بگیرید.', href: '/support' },
];

const STEPS: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'shamseh', title: 'به زُحل پی خوش آمدید', text: 'سفارش شبکه‌های اجتماعی و اشتراک هوش مصنوعی، شفاف و امن. این معرفی کوتاه فقط یک بار نشان داده می‌شود.' },
  { icon: 'grid', title: 'شبکه را انتخاب کنید', text: 'از صفحه‌ی خانه یک شبکه بزنید، نوع خدمت و تعداد را انتخاب کنید و سفارش را ثبت کنید.' },
  { icon: 'wallet', title: 'کیف پول و سفارش‌ها', text: 'کیف پول را شارژ کنید و در بخش سفارش‌ها مرحله‌ی هر سفارش را دنبال کنید.' },
  { icon: 'search', title: 'جستجو و راهنما', text: 'ذره‌بین بالای صفحه هر خدمتی را سریع پیدا می‌کند و دکمه‌ی علامت سؤال همیشه شما را به بخش درست می‌رساند.' },
];

function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const s = STEPS[i];
  return (
    <div className="zp-tour" role="dialog" aria-modal="true" aria-label="معرفی زُحل پی">
      <button type="button" className="zp-tour-scrim" aria-label="بستن معرفی" onClick={onClose} />
      <div className="zp-tour-card" key={i}>
        <Tile icon={s.icon} size={64} gold />
        <h2>{s.title}</h2>
        <p>{s.text}</p>
        <div className="dots" role="img" aria-label={`مرحله ${i + 1} از ${STEPS.length}`}>{STEPS.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <div className="act">
          {!last && <button type="button" className="skip" onClick={onClose}>رد کردن</button>}
          <button type="button" className="zp-cta zp-press" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'شروع' : 'بعدی'}</button>
        </div>
      </div>
    </div>
  );
}

/** First-run tour: shown once per browser (flag in localStorage), reopened from the help menu. */
export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const [tour, setTour] = useState(false);
  const onAdmin = (usePathname() ?? '').startsWith('/admin');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let seen = true;
    try { seen = Boolean(window.localStorage.getItem(TOUR_KEY)); } catch { /* private mode: skip the tour */ }
    if (!seen && !onAdmin) { const t = setTimeout(() => setTour(true), 600); return () => clearTimeout(t); }
  }, [onAdmin]);
  const closeTour = () => { setTour(false); try { window.localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ } };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="zp-ibtn zp-press" aria-label="راهنما" aria-expanded={open} onClick={() => setOpen(o => !o)}><ZIcon name="help" /></button>
      {open && (
        <div className="zp-pop zp-nb list zp-help-pop" role="dialog" aria-label="راهنما">
          <b className="hd">می‌خواهید چه کاری انجام دهید؟</b>
          {TOPICS.map(t => (
            <Link key={t.title} href={t.href} className="zp-nb-item zp-press" onClick={() => setOpen(false)}>
              <Tile icon={t.icon} />
              <span className="tx"><b>{t.title}</b><span>{t.text}</span></span>
            </Link>
          ))}
          <button type="button" className="again" onClick={() => { setOpen(false); setTour(true); }}>نمایش دوباره‌ی معرفی</button>
        </div>
      )}
      {tour && <Tour onClose={closeTour} />}
    </div>
  );
}
