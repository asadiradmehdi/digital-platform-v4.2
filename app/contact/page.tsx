import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Headphones, Mail, MessageCircle, ShieldAlert } from 'lucide-react';
import { PublicPage } from '../../components/seo/PublicPage';

export const metadata: Metadata = {
  title: 'تماس',
  description: 'ارتباط با تیم پلتفرم — پشتیبانی، همکاری، API و درخواست‌های سازمانی.',
  alternates: { canonical: '/contact' },
};

const channels = [
  {
    icon: Headphones,
    title: 'پشتیبانی محصول',
    description: 'برای مشکلات سفارش، حساب، پرداخت یا خطاهای فنی از تیکت سیستم استفاده کنید.',
    cta: 'ثبت تیکت',
    href: '/support/new',
  },
  {
    icon: MessageCircle,
    title: 'سؤال فروش',
    description: 'برای مقایسه پلن، قیمت‌گذاری سفارشی یا اشتراک‌های سازمانی با تیم فروش تماس بگیرید.',
    cta: 'مقایسه پلن‌ها',
    href: '/pricing',
  },
  {
    icon: Mail,
    title: 'همکاری و API',
    description: 'برای ادغام API، Reseller و مشارکت در اکوسیستم پلتفرم از طریق کانال رسمی اطلاع بدهید.',
    cta: 'مشاهده API',
    href: '/settings/api-keys',
  },
  {
    icon: ShieldAlert,
    title: 'گزارش امنیتی',
    description: 'اگر مشکل امنیتی دیدید، از بخش پشتیبانی برای ما تیکت بفرستید تا مستقیم به تیم امنیت برسد.',
    cta: 'پشتیبانی',
    href: '/support',
  },
];

export default function Contact() {
  return (
    <PublicPage
      eyebrow="تماس"
      title="از کجا می‌توان کمک گرفت؟"
      description="هر نوع درخواست یک مسیر مناسب دارد. از تیکت پشتیبانی تا گزارش امنیتی — راه درست را انتخاب کن."
    >
      <div className="public-card-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 40 }}>
        {channels.map(({ icon: Icon, title, description, cta, href }) => (
          <article className="public-info-card" key={title}>
            <span className="marketing-icon"><Icon size={18} /></span>
            <h2>{title}</h2>
            <p>{description}</p>
            <Link href={href} className="card-link">
              {cta} <ArrowLeft size={13} />
            </Link>
          </article>
        ))}
      </div>

      <div className="public-info-card">
        <h2>ساعات پاسخگویی</h2>
        <p>
          تیکت‌های پشتیبانی در روزهای کاری، معمولاً ظرف ۲ تا ۸ ساعت بررسی می‌شوند.
          برای مشترکین Pro، اولویت پاسخگویی بالاتر است.
          رخدادهای امنیتی خارج از ساعات اداری هم پیگیری می‌شوند.
        </p>
      </div>
    </PublicPage>
  );
}
