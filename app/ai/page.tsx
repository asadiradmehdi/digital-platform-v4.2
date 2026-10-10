import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { Ornament, Tile } from '../../components/zp/brand';
import { ZIcon, type IconName } from '../../components/zp/ZIcon';

export const metadata: Metadata = { title: 'هوش مصنوعی', robots: { index: false, follow: false } };

const TOOLS: { icon: IconName; title: string; text: string; brands: string }[] = [
  { icon: 'aiArticle', title: 'نوشتن و محتوا', text: 'کپشن، مقاله، ایمیل و هر متن فارسی یا انگلیسی؛ نوشتن، بازنویسی و خلاصه.', brands: 'ChatGPT | Claude | Gemini' },
  { icon: 'aiImage', title: 'ساخت تصویر', text: 'از یک توضیح ساده، تصویر محصول، پست و طرح تبلیغاتی بسازید.', brands: 'Midjourney | DALL·E' },
  { icon: 'aiScript', title: 'ویدیو و سناریو', text: 'سناریو، زیرنویس و ویدیوی کوتاه برای ریلز و استوری.', brands: 'Sora | Runway' },
  { icon: 'aiVoice', title: 'صدا و گفتار', text: 'متن را به صدای طبیعی تبدیل کنید یا فایل صوتی را به متن.', brands: 'ElevenLabs | Suno' },
  { icon: 'bot', title: 'کدنویسی و تحلیل', text: 'کد بنویسید، خطا پیدا کنید و داده‌های کسب‌وکارتان را تحلیل کنید.', brands: 'Cursor | Claude' },
  { icon: 'aiAssistant', title: 'دستیار خودکار', text: 'دستیاری که به سؤال مشتری‌ها جواب می‌دهد و کارهای تکراری را انجام می‌دهد.', brands: 'ChatGPT | Claude' },
];

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'rise', title: 'بهترین مدل، خودکار', text: 'برای هر درخواست، مناسب‌ترین و به‌صرفه‌ترین مدل انتخاب می‌شود.' },
  { icon: 'wallet', title: 'پرداخت به اندازه‌ی مصرف', text: 'هزینه‌ی هر درخواست از کیف پول کم می‌شود و در تاریخچه می‌ماند.' },
  { icon: 'hist', title: 'همه‌چیز ذخیره می‌شود', text: 'گفتگوها و خروجی‌ها همیشه در دسترس شماست.' },
];

export default function AI() {
  return (
    <AppShell>
      <main className="zp-screen zp-ai">
        <section className="zp-ai-hero">
          <Ornament id="ai-orn" />
          <div className="in">
            <span className="k">هوش مصنوعی زُحل پی</span>
            <h1>همه‌ی هوش مصنوعی‌های دنیا، یک‌جا و فارسی</h1>
            <p>بنویسید، بسازید و تحلیل کنید؛ بدون حساب خارجی و بدون ارز.</p>
            <div className="acts">
              <Link href="/ai/workspace" className="zp-cta zp-press">شروع گفتگو</Link>
              <Link href="/services/ai-subscriptions" className="alt zp-press">خرید اشتراک</Link>
            </div>
          </div>
        </section>

        <div className="zp-sec"><h2>چه کاری می‌خواهید انجام دهید؟</h2></div>
        <div className="zp-ai-grid">
          {TOOLS.map(t => (
            <Link key={t.title} href="/ai/workspace" className="zp-row zp-press">
              <Tile icon={t.icon} />
              <span className="t">
                <b>{t.title}</b>
                <small>{t.text}</small>
                <em dir="ltr">{t.brands}</em>
              </span>
              <ZIcon name="chevL" className="chev" />
            </Link>
          ))}
        </div>

        <div className="zp-sec"><h2>چرا اینجا؟</h2></div>
        <div className="zp-ai-promises">
          {PROMISES.map(p => (
            <div key={p.title}>
              <Tile icon={p.icon} gold />
              <b>{p.title}</b>
              <small>{p.text}</small>
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
