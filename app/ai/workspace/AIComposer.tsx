'use client';
import { useRef, useState } from 'react';
import { ArrowUp, Bot, Code2, ImageIcon, Paperclip, Plus, Search, Sparkles, Zap } from 'lucide-react';

const STARTERS = [
  { icon: Sparkles, label: 'تولید محتوای اینستاگرام', prompt: 'کپشن فارسی حرفه‌ای برای ۵ پست اینستاگرام درباره یک محصول دیجیتال بنویس.' },
  { icon: Code2, label: 'تحلیل داده کسب‌وکار', prompt: 'روش تحلیل عملکرد ماهانه یک کسب‌وکار آنلاین را با شاخص‌های کلیدی توضیح بده.' },
  { icon: ImageIcon, label: 'توضیحات تصویری', prompt: 'Alt text حرفه‌ای برای تصویر محصول الکترونیکی بنویس که SEO-friendly باشد.' },
  { icon: Search, label: 'تحقیق بازار', prompt: 'روش تحلیل رقبا و ترندهای صنعت خدمات دیجیتال را خلاصه کن.' },
  { icon: Bot, label: 'نوشتن ایمیل', prompt: 'یک ایمیل فروش حرفه‌ای فارسی برای معرفی سرویس هوش مصنوعی به مشتری B2B بنویس.' },
  { icon: Zap, label: 'ساخت Workflow', prompt: 'یک Workflow برای پاسخ خودکار به تیکت‌های پشتیبانی مشتریان طراحی کن.' },
];

type Message = { role: 'user' | 'assistant'; content: string };

export default function AIComposer() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const send = async (prompt?: string) => {
    const text = (prompt ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setError(null);
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/generate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', prompt: text, stream: false }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string; code?: string } };
        throw new Error(err.error?.message ?? `خطا ${res.status}`);
      }
      const data = await res.json() as { response?: { content?: string } };
      const reply = data.response?.content ?? '—';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ناشناخته');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ai-canvas">
      {messages.length === 0 && !loading ? (
        <div className="ai-empty">
          <div className="ai-empty-icon"><Sparkles size={22} /></div>
          <h2>از کجا شروع می‌کنی؟</h2>
          <p>یک درخواست بنویس یا یکی از پیشنهادهای زیر را انتخاب کن.</p>
          <div className="ai-starters">
            {STARTERS.map(({ icon: Icon, label, prompt }) => (
              <button key={label} type="button" className="ai-starter-btn" onClick={() => send(prompt)}>
                <Icon size={14} />
                <span>
                  <b>{label}</b>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ai-messages">
          {messages.map((m, i) => (
            <div key={i} className={`ai-message ai-message-${m.role}`}>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13, lineHeight: 1.8 }}>{m.content}</p>
            </div>
          ))}
          {loading && (
            <div className="ai-message ai-message-assistant">
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>در حال پردازش...</p>
            </div>
          )}
          {error && (
            <div className="ai-message ai-message-error">
              <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)' }}>{error}</p>
            </div>
          )}
        </div>
      )}

      <div className="ai-composer">
        <div className="composer-top">
          <span>خودکار · Claude Haiku</span>
          <button type="button" className="button secondary" style={{ fontSize: 11, padding: '4px 10px', height: 'auto' }} onClick={() => { setMessages([]); setError(null); }}>
            <Plus size={12}/>مکالمه جدید
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className="composer-input"
          aria-label="ورودی درخواست"
          rows={3}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="مثلاً: کپشن اینستاگرام فارسی برای تبلیغ محصول جدیدم بنویس..."
          style={{ resize: 'none', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', outline: 'none', fontSize: 13, lineHeight: 1.8, color: 'var(--ink)' }}
          disabled={loading}
        />
        <div className="composer-bottom">
          <button type="button" aria-label="پیوست فایل" disabled>
            <Paperclip size={17} />
          </button>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Shift+Enter برای خط جدید</span>
          <span style={{ fontSize: 9, color: 'var(--subtle)', marginInlineStart: 'auto', marginInlineEnd: 8 }}>
            Enter ↵ ارسال
          </span>
          <button type="button" className="composer-send" aria-label="ارسال" onClick={() => void send()} disabled={!input.trim() || loading}>
            <ArrowUp size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
