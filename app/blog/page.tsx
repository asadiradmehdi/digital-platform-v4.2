import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PublicPage } from '../../components/seo/PublicPage';

export const metadata: Metadata = {
  title: 'مقالات',
  description: 'مقالات آموزشی و مرجع درباره AI، اتوماسیون، خدمات دیجیتال و زیرساخت کسب‌وکار.',
  alternates: { canonical: '/blog' },
};

const posts = [
  {
    slug: 'ai-gateway',
    title: 'AI Gateway چیست و چرا برای کسب‌وکار اهمیت دارد؟',
    summary:
      'AI Gateway یک لایه میانی بین اپلیکیشن شما و ارائه‌دهندگان مختلف مدل (Anthropic، OpenAI و غیره) است. این لایه routing هوشمند، usage tracking، rate-limit و fallback را متمرکز می‌کند تا نه هزینه‌ها از کنترل خارج شوند و نه اختلال یک provider کل سرویس را متوقف کند.',
    tags: ['AI', 'معماری'],
    readTime: '۵ دقیقه',
  },
  {
    slug: 'workflow-automation',
    title: 'طراحی Workflow برای عملیات کسب‌وکار',
    summary:
      'یک Workflow خوب چهار مشخصه دارد: Trigger مشخص، شرط‌های صریح، Actionهای idempotent و run history کامل. وقتی این چهار عنصر کنار هم باشند، اتوماسیون قابل debug و قابل اعتماد است — نه یک جعبه سیاه.',
    tags: ['اتوماسیون', 'عملیات'],
    readTime: '۶ دقیقه',
  },
  {
    slug: 'social-growth',
    title: 'رشد در شبکه‌های اجتماعی: چه چیزی کار می‌کند؟',
    summary:
      'فالوور بدون engagement ارزش تبلیغاتی ندارد. داده‌های واقعی نشان می‌دهد که consistency در زمان انتشار، پاسخ به کامنت‌ها در ۶۰ دقیقه اول و محتوای native برای هر پلتفرم بیشترین تأثیر را روی دسترسی ارگانیک دارند.',
    tags: ['اینستاگرام', 'رشد'],
    readTime: '۴ دقیقه',
  },
  {
    slug: 'api-security',
    title: 'امنیت API Key: اشتباهات رایج و راه‌حل',
    summary:
      'API Key در source code، در محیط client-side، بدون scope محدود یا بدون expiry — هر کدام یک نقطه شکست جداست. اصل least privilege می‌گوید هر کلید فقط باید به آنچه نیاز دارد دسترسی داشته باشد، نه بیشتر.',
    tags: ['امنیت', 'API'],
    readTime: '۵ دقیقه',
  },
  {
    slug: 'multi-workspace',
    title: 'چرا معماری Multi-Workspace برای آژانس‌ها مهم است؟',
    summary:
      'وقتی یک آژانس چندین کلاینت دارد، isolation داده بین workspace‌ها یک requirement امنیتی است، نه یک feature. هر Workspace باید کیف پول، سفارش، کانال‌های اجتماعی و API keyهای مستقل داشته باشد.',
    tags: ['B2B', 'معماری'],
    readTime: '۴ دقیقه',
  },
];

export default function Blog() {
  return (
    <PublicPage
      eyebrow="BLOG"
      title="مرجع یادگیری و تصمیم‌گیری"
      description="مقالات پاسخ‌محور درباره AI، اتوماسیون، امنیت و عملیات کسب‌وکار دیجیتال."
    >
      <div className="public-list">
        {posts.map(post => (
          <article key={post.slug}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {post.tags.map(tag => (
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
              <span style={{ fontSize: 11, color: 'var(--subtle)', marginInlineStart: 'auto' }}>
                {post.readTime}
              </span>
            </div>
            <h2 style={{ marginBottom: 8 }}>{post.title}</h2>
            <p style={{ marginBottom: 12 }}>{post.summary}</p>
            <Link href={`/blog/${post.slug}`} className="card-link">
              ادامه مطلب <ArrowLeft size={13} />
            </Link>
          </article>
        ))}
      </div>
    </PublicPage>
  );
}
