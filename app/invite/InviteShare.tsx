'use client';
import { useEffect, useState } from 'react';
import { ZIcon } from '../../components/zp/ZIcon';

const fa = (n: number) => n.toLocaleString('fa-IR', { maximumFractionDigits: 1 });

export function InviteShare({ code, link, welcomePercent }: { code: string; link: string; welcomePercent: number }) {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const message = welcomePercent > 0
    ? `با لینک من توی زُحل پی عضو شو و با اولین خرید ${fa(welcomePercent)}٪ اعتبار هدیه بگیر:\n${link}`
    : `با لینک من توی زُحل پی عضو شو:\n${link}`;

  const copy = async (text: string, done: string) => {
    try { await navigator.clipboard.writeText(text); setToast(done); }
    catch { setToast('کپی انجام نشد؛ لینک را نگه دارید و دستی کپی کنید.'); }
  };
  // Native share sheet where the browser has one; otherwise the ready-made message is copied.
  const share = async () => {
    if (typeof navigator.share !== 'function') return copy(message, 'متن دعوت کپی شد؛ برای دوستانتان بفرستید');
    try { await navigator.share({ title: 'زُحل پی', text: message }); } catch { /* dismissed */ }
  };
  const enc = encodeURIComponent;

  return (
    <section className="zp-share" aria-label="کد و لینک دعوت">
      <div className="code">
        <div><span>کد دعوت شما</span><b className="zp-ltr" dir="ltr">{code}</b></div>
        <button type="button" className="zp-ibtn zp-press" onClick={() => copy(code, 'کد دعوت کپی شد')} aria-label="کپی کد دعوت"><ZIcon name="copy" /></button>
      </div>
      <div className="acts">
        <button type="button" className="zp-cta zp-press" onClick={share}><ZIcon name="share" />ارسال دعوت</button>
        <a className="zp-sbtn zp-press" href={`https://t.me/share/url?url=${enc(link)}&text=${enc(message.split('\n')[0])}`} target="_blank" rel="noopener noreferrer" aria-label="ارسال در تلگرام"><ZIcon name="tg" /></a>
        <a className="zp-sbtn zp-press" href={`https://wa.me/?text=${enc(message)}`} target="_blank" rel="noopener noreferrer" aria-label="ارسال در واتساپ"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.63.71.23 1.36.2 1.88.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.93.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47a9.4 9.4 0 0 1 6.7 2.78 9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46zm8.06-17.53A11.33 11.33 0 0 0 12.04.63C5.76.63.65 5.73.65 12.01c0 2 .52 3.97 1.52 5.7L.55 23.62l6.04-1.58a11.36 11.36 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.33-8.05z"/></svg></a>
        <button type="button" className="zp-sbtn zp-press" onClick={() => copy(link, 'لینک دعوت کپی شد')} aria-label="کپی لینک دعوت"><ZIcon name="copy" /></button>
      </div>
      <div className={`zp-toast${toast ? ' on' : ''}`} role="status" aria-live="polite">{toast}</div>
    </section>
  );
}
