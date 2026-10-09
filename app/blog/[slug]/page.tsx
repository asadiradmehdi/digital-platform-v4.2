import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { PublicPage } from '../../../components/seo/PublicPage';

const articles: Record<string, { title: string; summary: string; tags: string[]; readTime: string; body: string }> = {
  'ai-gateway': {
    title: 'AI Gateway چیست و چرا برای کسب‌وکار اهمیت دارد؟',
    summary: 'AI Gateway یک لایه میانی بین اپلیکیشن شما و ارائه‌دهندگان مختلف مدل است.',
    tags: ['AI', 'معماری'],
    readTime: '۵ دقیقه',
    body: `
یک AI Gateway سه مسئله اصلی را حل می‌کند:

**۱. هزینه غیرقابل پیش‌بینی**
وقتی مستقیم با API مدل‌ها کار می‌کنید، هر باگ در کد یا رفتار غیرمنتظره کاربر می‌تواند هزینه token را ناگهان چند برابر کند. Gateway هم rate-limit اعمال می‌کند هم usage هر درخواست را ثبت می‌کند تا بتوان ناهنجاری را زود شناسایی کرد.

**۲. وابستگی به یک ارائه‌دهنده**
اگر Anthropic یا OpenAI دچار اختلال شود، سرویس شما هم متوقف می‌شود. با Gateway می‌توان یک fallback hierarchy تعریف کرد: مدل اول → مدل دوم → ارائه‌دهنده جایگزین.

**۳. انتخاب مدل بر اساس task**
برای یک خلاصه‌سازی ساده، استفاده از گران‌ترین مدل اتلاف هزینه است. AI Router می‌تواند بر اساس نوع task، طول ورودی و بودجه workspace، بهینه‌ترین مدل را انتخاب کند.

**معماری پیشنهادی**
در این پلتفرم، هر درخواست AI از مسیر زیر عبور می‌کند:

۱. احراز هویت و بررسی اعتبار subscription
۲. انتخاب مدل توسط AI Router
۳. اجرا با ارائه‌دهنده انتخابی
۴. ثبت مصرف token، هزینه و وضعیت در audit log
۵. بازگشت نتیجه به کاربر (streaming یا batch)

این معماری تضمین می‌کند که هیچ هزینه‌ای بدون ثبت اتفاق نمی‌افتد و هر خرابی ارائه‌دهنده به سرویس کلی منتقل نمی‌شود.
    `.trim(),
  },
  'workflow-automation': {
    title: 'طراحی Workflow برای عملیات کسب‌وکار',
    summary: 'یک Workflow خوب چهار مشخصه دارد: Trigger مشخص، شرط‌های صریح، Actionهای idempotent و run history کامل.',
    tags: ['اتوماسیون', 'عملیات'],
    readTime: '۶ دقیقه',
    body: `
**اشتباه رایج: Workflow بدون idempotency**
اگر یک Action در میانه اجرا fail کند و دوباره اجرا شود، باید نتیجه یکسان باشد. بدون idempotency، یک ایمیل دو بار ارسال می‌شود، یک پرداخت دو بار انجام می‌شود، یا یک رکورد دو بار insert می‌شود.

**چهار عنصر یک Workflow قابل اعتماد**

۱. **Trigger مشخص**: رویداد دقیق و قابل اندازه‌گیری — نه «وقتی کاربر کاری کرد».

۲. **شرط‌های صریح**: هر branch باید condition روشن داشته باشد. شرط‌های ضمنی (مثل «اگر چیزی اشتباه نبود») منبع bug هستند.

۳. **Actionهای idempotent**: هر Action باید idempotency key داشته باشد تا در صورت retry، عملیات تکرار نشود.

۴. **Run history کامل**: هر اجرا باید log کامل داشته باشد — چه ورودی‌ای داشت، کجا رفت، کجا fail کرد، چقدر طول کشید.

**نمونه واقعی: پاسخ خودکار به تیکت**

Trigger: تیکت جدید با category=order و priority=urgent
↓ شرط: آیا سفارش مرتبط وجود دارد؟
↓ اگر بله: ارسال تأییدیه خودکار با جزئیات سفارش
↓ اگر خیر: escalate به تیم پشتیبانی
↓ Delay: ۴ ساعت
↓ شرط: آیا تیکت هنوز open است؟
↓ اگر بله: ارسال reminder به agent

این Workflow قابل debug، قابل pause، قابل retry و قابل audit است.
    `.trim(),
  },
  'social-growth': {
    title: 'رشد در شبکه‌های اجتماعی: چه چیزی کار می‌کند؟',
    summary: 'فالوور بدون engagement ارزش تبلیغاتی ندارد. داده‌های واقعی نشان می‌دهد که consistency مهم‌ترین عامل رشد است.',
    tags: ['اینستاگرام', 'رشد'],
    readTime: '۴ دقیقه',
    body: `
**چرا فالوور اهمیت ندارد؟**
الگوریتم‌های اینستاگرام و یوتیوب دسترسی (reach) را به engagement rate گره زده‌اند، نه به تعداد فالوور. یک اکانت با ۵۰۰۰ فالوور فعال اغلب بهتر از اکانت با ۵۰٬۰۰۰ فالوور غیرفعال عمل می‌کند.

**سه عامل تأثیرگذار**

**۱. Consistency در زمان انتشار**
الگوریتم‌ها به اکانت‌هایی که به‌طور منظم منتشر می‌کنند اعتماد می‌کنند. ارسال ۳ پست در یک هفته و صفر در دو هفته بعد، reach را کاهش می‌دهد.

**۲. پاسخ در ۶۰ دقیقه اول**
دقایق اول پس از انتشار برای اینستاگرام بحرانی است. پاسخ به کامنت‌ها و reply به DM در این بازه، سیگنال engagement قوی‌تری ارسال می‌کند.

**۳. محتوای native برای هر پلتفرم**
یک ویدیوی ۱۰ دقیقه‌ای یوتیوب که در اینستاگرام ریلز به ۳۰ ثانیه کوتاه شده، عملکرد ضعیف‌تری از محتوای اصیل دارد. هر پلتفرم فرمت، ریتم و رفتار مخصوص خود را دارد.

**نقش خدمات تقویت**
خدمات تقویت شبکه‌های اجتماعی می‌توانند یک push اولیه برای محتوای با کیفیت بالا ایجاد کنند، اما جایگزین محتوای ارگانیک نیستند. بهترین نتیجه زمانی است که محتوا قبلاً engagement طبیعی داشته باشد.
    `.trim(),
  },
  'api-security': {
    title: 'امنیت API Key: اشتباهات رایج و راه‌حل',
    summary: 'API Key بدون scope یا expiry یک نقطه شکست جدی است. اصل least privilege رویکرد استاندارد است.',
    tags: ['امنیت', 'API'],
    readTime: '۵ دقیقه',
    body: `
**پنج اشتباه رایج**

**۱. API Key در source code**
حتی یک commit خصوصی هم می‌تواند از طریق git history leak شود. کلیدها باید در environment variables یا secret vault ذخیره شوند.

**۲. API Key بدون scope**
یک کلید با دسترسی کامل به همه endpoints، اگر leak شود، آسیب حداکثری می‌رساند. هر کلید باید فقط به scope‌هایی که نیاز دارد محدود شود.

**۳. API Key بدون expiry**
کلیدی که expire نمی‌شود اگر یک‌بار leak شود، برای همیشه قابل استفاده است.

**۴. API Key در client-side**
هیچ API Key سروری نباید در JavaScript browser، React Native bundle یا هر client-side code قرار بگیرد.

**۵. عدم logging استفاده**
بدون monitoring مصرف، یک کلید دزدیده‌شده می‌تواند ماه‌ها بدون شناسایی استفاده شود.

**راه‌حل عملی**

- هر integration یک کلید مستقل با scope محدود
- Rotation برنامه‌ریزی‌شده (هر ۹۰ روز)
- Alert برای استفاده غیرعادی (IP جدید، حجم بالا)
- Sandbox environment برای توسعه و تست
- Revocation فوری با یک کلیک از داشبورد
    `.trim(),
  },
  'multi-workspace': {
    title: 'چرا معماری Multi-Workspace برای آژانس‌ها مهم است؟',
    summary: 'Isolation داده بین workspace‌ها یک requirement امنیتی است، نه یک feature.',
    tags: ['B2B', 'معماری'],
    readTime: '۴ دقیقه',
    body: `
**مشکل: یک حساب برای همه کلاینت‌ها**
وقتی یک آژانس همه کلاینت‌های خود را در یک workspace مدیریت می‌کند، چند ریسک جدی وجود دارد:

- داده سفارش‌های کلاینت A برای کلاینت B قابل مشاهده است
- یک عضو تیم با دسترسی اشتباه می‌تواند داده کلاینت‌ها را ببیند
- موجودی کیف پول مشترک است و attribution هزینه مشخص نیست
- API keyها بین پروژه‌ها مشترک هستند

**راه‌حل: یک Workspace مستقل برای هر کلاینت**

در معماری Multi-Workspace، هر Workspace دارای موارد زیر است:

- **کیف پول مستقل**: هزینه هر کلاینت جداگانه track می‌شود
- **اعضای مجزا**: دسترسی عضو تیم محدود به workspace‌هایی است که عضو آن است
- **سفارش‌های ایزوله**: سفارش‌های یک workspace در workspace دیگر نمایش داده نمی‌شود
- **API keyهای جداگانه**: هر workspace API keyهای مخصوص خود دارد
- **کانال‌های اجتماعی مستقل**: اکانت‌های اینستاگرام و تلگرام هر کلاینت در workspace خودش
    `.trim(),
  },
};

export function generateStaticParams() {
  return Object.keys(articles).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = articles[slug];
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: `/blog/${slug}` },
  };
}

export default async function BlogArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = articles[slug];
  if (!article) return notFound();

  const paragraphs = article.body.split('\n\n');

  return (
    <PublicPage eyebrow="BLOG" title={article.title} description={article.summary}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {article.tags.map(tag => (
          <span
            key={tag}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'var(--surface-2)',
              color: 'var(--subtle)',
            }}
          >
            {tag}
          </span>
        ))}
        <span style={{ fontSize: 11, color: 'var(--subtle)' }}>{article.readTime}</span>
      </div>

      <div className="public-info-card" style={{ marginBottom: 16 }}>
        {paragraphs.map((para, i) => {
          if (para.startsWith('**') && para.endsWith('**') && para.split('**').length === 3) {
            return <h2 key={i} style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, marginTop: i > 0 ? 20 : 0 }}>{para.slice(2, -2)}</h2>;
          }
          const lines = para.split('\n');
          return (
            <div key={i} style={{ marginBottom: 12 }}>
              {lines.map((line, j) => {
                if (line.startsWith('**') && line.includes('**', 2)) {
                  const end = line.indexOf('**', 2);
                  return (
                    <p key={j} style={{ marginBottom: 4 }}>
                      <strong>{line.slice(2, end)}</strong>
                      {line.slice(end + 2)}
                    </p>
                  );
                }
                if (line.startsWith('- ')) {
                  return <p key={j} style={{ marginBottom: 4, paddingInlineStart: 16 }}>• {line.slice(2)}</p>;
                }
                if (line.startsWith('↓')) {
                  return <p key={j} style={{ marginBottom: 4, paddingInlineStart: 16, color: 'var(--subtle)', fontSize: 13 }}>{line}</p>;
                }
                return line ? <p key={j} style={{ marginBottom: 4 }}>{line}</p> : null;
              })}
            </div>
          );
        })}
      </div>

      <Link href="/blog" className="card-link">
        <ArrowRight size={13} /> بازگشت به مقالات
      </Link>
    </PublicPage>
  );
}
