import Link from 'next/link';
import { ArrowUp, Bot, Code2, ImageIcon, Paperclip, Plus, Search, Sparkles, Zap } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';

export const metadata = { title: 'محیط هوش مصنوعی', robots: { index: false, follow: false } };

const starterPrompts = [
  { icon: Sparkles, label: 'تولید محتوای اینستاگرام', desc: 'کپشن فارسی برای ۱۰ پست متفاوت' },
  { icon: Code2, label: 'تحلیل داده کسب‌وکار', desc: 'گزارش عملکرد ماهانه را خلاصه کن' },
  { icon: ImageIcon, label: 'توضیحات تصویری', desc: 'Alt text حرفه‌ای برای محصولات' },
  { icon: Search, label: 'تحقیق بازار', desc: 'رقبا و ترندهای صنعت را بررسی کن' },
  { icon: Bot, label: 'نوشتن ایمیل', desc: 'ایمیل فروش حرفه‌ای به مشتری' },
  { icon: Zap, label: 'ساخت Workflow', desc: 'اتوماسیون پاسخ به تیکت‌های پشتیبانی' },
];

export default function AIWorkspace() {
  return (
    <AppShell>
      <main className="workspace-page-content">
        <div className="ai-workspace-shell">
          <header className="ai-workspace-head">
            <div>
              <span className="eyebrow">هوش مصنوعی · محیط اجرا</span>
              <h1>مسئله را وارد کن.</h1>
              <p>مدل، context، فایل‌ها و مصرف در همین محیط کنترل می‌شوند.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link className="button secondary" href="/ai"><Plus size={15} />پروژه جدید</Link>
              <Link className="button secondary" href="/ai">همه پروژه‌ها</Link>
            </div>
          </header>

          <section className="ai-canvas">
            <div className="ai-empty">
              <div className="ai-empty-icon"><Sparkles size={22} /></div>
              <h2>از کجا شروع می‌کنی؟</h2>
              <p>یک درخواست بنویس یا یکی از پیشنهادهای زیر را انتخاب کن.</p>

              <div className="ai-starters">
                {starterPrompts.map(({ icon: Icon, label, desc }) => (
                  <button key={label} type="button" className="ai-starter-btn">
                    <Icon size={14} />
                    <span>
                      <b>{label}</b>
                      <small>{desc}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ai-composer">
              <div className="composer-top">
                <span>خودکار · مدل توسط AI Router انتخاب می‌شود</span>
                <span>زمینه: فضای کاری اصلی</span>
              </div>
              <div className="composer-input" role="textbox" aria-label="ورودی درخواست" suppressHydrationWarning>
                مثلاً: کپشن اینستاگرام فارسی برای تبلیغ محصول جدیدم بنویس...
              </div>
              <div className="composer-bottom">
                <button type="button" aria-label="پیوست فایل">
                  <Paperclip size={17} />
                </button>
                <span>۰ فایل</span>
                <span style={{ fontSize: 9, color: 'var(--subtle)', marginInlineStart: 'auto', marginInlineEnd: 8 }}>
                  Enter ↵ ارسال
                </span>
                <button type="button" className="composer-send" aria-label="ارسال">
                  <ArrowUp size={17} />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
