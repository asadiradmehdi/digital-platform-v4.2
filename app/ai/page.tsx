import type { Metadata } from 'next';
import { AudioLines, Bot, Code2, Image, Sparkles, Video, ArrowUpLeft, Zap } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SurfaceHero } from '../../components/ProductSurface';
import Link from 'next/link';

export const metadata: Metadata = { title: 'هوش مصنوعی', robots: { index: false, follow: false } };

const MODEL_CATEGORIES = [
  {
    eyebrow: 'زبان',
    title: 'نوشتن و محتوا',
    description: 'کپشن، مقاله، ایمیل و هر متن فارسی یا انگلیسی را با مدل‌های زبانی بنویسید، بازنویسی یا خلاصه کنید.',
    icon: Sparkles,
    models: ['GPT-4o', 'Claude 3.5', 'Gemini Pro'],
    href: '/ai/workspace',
    meta: 'متن · ترجمه · خلاصه',
  },
  {
    eyebrow: 'تصویر',
    title: 'تولید تصویر',
    description: 'از توضیح متنی به تصویر برسید؛ برای محتوا، محصول یا بازاریابی.',
    icon: Image,
    models: ['DALL·E 3', 'Stable Diffusion', 'Midjourney'],
    href: '/ai/workspace',
    meta: 'تصویر · ویرایش · سبک',
  },
  {
    eyebrow: 'ویدیو',
    title: 'پردازش ویدیو',
    description: 'ویدیو بسازید یا متن آن را استخراج کنید؛ مصرف به‌صورت لحظه‌ای محاسبه می‌شود.',
    icon: Video,
    models: ['Sora', 'Runway', 'Pika'],
    href: '/ai/workspace',
    meta: 'ویدیو · پردازش · مصرف',
  },
  {
    eyebrow: 'صدا',
    title: 'صدا و گفتار',
    description: 'متن را به صدای طبیعی تبدیل کنید یا فایل صوتی را به متن دربیاورید.',
    icon: AudioLines,
    models: ['Whisper', 'ElevenLabs', 'TTS-1'],
    href: '/ai/workspace',
    meta: 'صدا · گفتار · TTS',
  },
  {
    eyebrow: 'کد',
    title: 'کدنویسی و تحلیل',
    description: 'کد بنویسید، باگ پیدا کنید یا داده را با یک مدل تخصصی تحلیل کنید.',
    icon: Code2,
    models: ['Claude 3.5', 'GPT-4o', 'Gemini'],
    href: '/ai/workspace',
    meta: 'کد · تحلیل · تحقیق',
  },
  {
    eyebrow: 'عامل',
    title: 'هوش مصنوعی خودکار',
    description: 'عامل‌هایی بسازید که با ابزارها کار کنند، به پایگاه دانش دسترسی داشته باشند و قابل ردیابی باشند.',
    icon: Bot,
    models: ['GPT-4o', 'Claude 3 Opus', 'LangChain'],
    href: '/ai/workspace',
    meta: 'Agent · RAG · Audit',
  },
] as const;

export default function AI() {
  return (
    <AppShell>
      <main className="workspace-page-content">
        <SurfaceHero
          eyebrow="هوش مصنوعی"
          title="یک محیط، همه مدل‌ها."
          description="متن بنویسید، تصویر بسازید، کد تحلیل کنید یا فرآیند خودکار راه‌اندازی کنید — همه از یک جا، با کنترل کامل هزینه."
          primaryHref="/ai/workspace"
          primaryLabel="شروع کار"
          secondaryHref="/pricing"
          secondaryLabel="مشاهده پلن‌ها"
        />

        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <span className="eyebrow">دسته‌بندی مدل‌ها</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 0', letterSpacing: '-.02em' }}>
                چه کاری می‌خواهید انجام دهید؟
              </h2>
            </div>
            <Link
              href="/ai/workspace"
              className="button secondary"
              style={{ flexShrink: 0 }}
            >
              شروع کار <ArrowUpLeft size={14} />
            </Link>
          </div>

          <div className="product-card-grid-premium">
            {MODEL_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link key={cat.title} href={cat.href} className="product-card" style={{ textDecoration: 'none' }}>
                  <div className="product-card-icon">
                    <Icon size={18} />
                  </div>
                  <div className="product-card-copy">
                    <div className="product-card-title">
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: 'var(--accent)', marginBottom: 3, textTransform: 'uppercase' }}>
                          {cat.eyebrow}
                        </div>
                        <h2 style={{ margin: 0 }}>{cat.title}</h2>
                      </div>
                      <ArrowUpLeft size={15} />
                    </div>
                    <p>{cat.description}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--subtle)' }}>{cat.meta}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {cat.models.slice(0, 2).map((m) => (
                          <span
                            key={m}
                            className="text-ltr"
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 5,
                              background: 'var(--surface-2)',
                              color: 'var(--subtle)',
                              fontFamily: 'var(--font-latin)',
                              letterSpacing: 0,
                            }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <article
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'var(--accent-soft)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--accent)',
                }}
              >
                <Zap size={16} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700 }}>انتخاب خودکار مدل</span>
            </div>
            <p style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.9, margin: 0 }}>
              سیستم بر اساس نوع درخواست، بهترین مدل را با کمترین هزینه انتخاب می‌کند.
            </p>
          </article>
          <article
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(22,163,74,.08)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--success)',
                }}
              >
                <Sparkles size={16} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700 }}>هزینه هر درخواست</span>
            </div>
            <p style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.9, margin: 0 }}>
              مصرف هر بار از کیف پول کسر می‌شود و در تاریخچه قابل مشاهده است.
            </p>
          </article>
          <article
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(2,132,199,.08)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--info)',
                }}
              >
                <Bot size={16} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700 }}>تاریخچه مکالمات</span>
            </div>
            <p style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.9, margin: 0 }}>
              هر مکالمه با هزینه و وضعیت ثبت می‌شود و همیشه قابل بررسی است.
            </p>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
