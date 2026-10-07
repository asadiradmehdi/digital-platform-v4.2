'use client';
import { useRef, useState } from 'react';
import {
  ArrowUp, Bot, ChevronDown, Code2, ImageIcon,
  Paperclip, Plus, Search, Sparkles, Zap,
} from 'lucide-react';

const STARTERS = [
  {
    icon: Sparkles,
    label: 'تولید محتوای اینستاگرام',
    prompt: 'کپشن فارسی حرفه‌ای برای ۵ پست اینستاگرام درباره یک محصول دیجیتال بنویس.',
  },
  {
    icon: Code2,
    label: 'تحلیل داده کسب‌وکار',
    prompt: 'روش تحلیل عملکرد ماهانه یک کسب‌وکار آنلاین را با شاخص‌های کلیدی توضیح بده.',
  },
  {
    icon: ImageIcon,
    label: 'توضیحات تصویری',
    prompt: 'Alt text حرفه‌ای برای تصویر محصول الکترونیکی بنویس که SEO-friendly باشد.',
  },
  {
    icon: Search,
    label: 'تحقیق بازار',
    prompt: 'روش تحلیل رقبا و ترندهای صنعت خدمات دیجیتال را خلاصه کن.',
  },
  {
    icon: Bot,
    label: 'نوشتن ایمیل فروش',
    prompt: 'یک ایمیل فروش حرفه‌ای فارسی برای معرفی سرویس هوش مصنوعی به مشتری B2B بنویس.',
  },
  {
    icon: Zap,
    label: 'طراحی Workflow',
    prompt: 'یک Workflow برای پاسخ خودکار به تیکت‌های پشتیبانی مشتریان طراحی کن.',
  },
];

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku', badge: 'سریع' },
  { id: 'gpt-4o', label: 'GPT-4o', badge: 'قدرتمند' },
];

type Message = { role: 'user' | 'assistant'; content: string };

export default function AIComposer() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelId] = useState(MODELS[0]!.id);
  const [modelLabel] = useState(MODELS[0]!.label);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const send = async (prompt?: string) => {
    const text = (prompt ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setError(null);
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);

    // Auto-scroll to bottom
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const wsRes = await fetch('/api/v1/workspaces', { credentials: 'same-origin' });
      if (!wsRes.ok) throw new Error('لطفاً ابتدا وارد حساب کاربری شوید.');
      const wsData = await wsRes.json() as { items: Array<{ id: string }> };
      const workspaceId = wsData.items[0]?.id;
      if (!workspaceId) throw new Error('فضای کاری یافت نشد.');

      const res = await fetch('/api/v1/ai/generate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        body: JSON.stringify({
          workspaceId,
          model: modelId,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          stream: false,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string; code?: string } };
        throw new Error(err.error?.message ?? `خطا ${res.status}`);
      }
      const data = await res.json() as { text?: string };
      const reply = data.text ?? '—';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ناشناخته');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ai-canvas">
      {/* ── Empty / Starter state ─────────────────────────────────── */}
      {messages.length === 0 && !loading ? (
        <div className="ai-empty">
          <div className="ai-empty-icon">
            <Sparkles size={22} />
          </div>
          <h2>از کجا شروع می‌کنی؟</h2>
          <p>یک درخواست بنویس یا یکی از پیشنهادهای زیر را انتخاب کن.</p>
          <div className="ai-starters">
            {STARTERS.map(({ icon: Icon, label, prompt }) => (
              <button
                key={label}
                type="button"
                className="ai-starter-btn"
                onClick={() => void send(prompt)}
              >
                <Icon size={14} />
                <span>
                  <b>{label}</b>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Message thread ───────────────────────────────────────── */
        <div className="ai-messages">
          {messages.map((m, i) => (
            <div key={i} className={`ai-message ai-message-${m.role}`}>
              {m.role === 'assistant' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
                    opacity: 0.6,
                  }}
                >
                  <Bot size={12} />
                  <span
                    className="text-ltr"
                    style={{ fontSize: 9, fontFamily: 'var(--font-latin)', letterSpacing: '.02em' }}
                  >
                    {modelLabel}
                  </span>
                </div>
              )}
              <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13, lineHeight: 1.85 }}>
                {m.content}
              </p>
            </div>
          ))}

          {loading && (
            <div className="ai-message ai-message-assistant">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bot size={12} style={{ opacity: 0.5 }} />
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>در حال پردازش</span>
                <span
                  style={{
                    display: 'inline-flex',
                    gap: 3,
                    marginInlineStart: 2,
                  }}
                >
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        opacity: 0.4,
                        animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div
              className="ai-message ai-message-error"
              role="alert"
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)' }}>خطا</span>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)' }}>{error}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* ── Composer bar ──────────────────────────────────────────── */}
      <div className="ai-composer">
        <div className="composer-top">
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '4px 8px',
              fontSize: 10,
              fontFamily: 'var(--font-latin)',
              color: 'var(--ink)',
              cursor: 'default',
              letterSpacing: '.01em',
            }}
            title="انتخاب مدل — به‌زودی"
          >
            <Bot size={12} style={{ color: 'var(--accent)' }} />
            {modelLabel}
            <ChevronDown size={11} style={{ opacity: 0.5 }} />
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 10,
                color: 'var(--muted)',
                padding: '4px 6px',
                borderRadius: 6,
              }}
              onClick={() => { setMessages([]); setError(null); }}
            >
              <Plus size={12} />
              مکالمه جدید
            </button>
          )}
        </div>

        <textarea
          ref={textareaRef}
          className="composer-input"
          aria-label="ورودی درخواست"
          rows={3}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="مثلاً: کپشن اینستاگرام فارسی برای تبلیغ محصول جدیدم بنویس..."
          style={{
            resize: 'none',
            width: '100%',
            padding: '10px 12px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            lineHeight: 1.85,
            color: 'var(--ink)',
            fontFamily: 'var(--font-fa)',
          }}
          disabled={loading}
        />

        <div className="composer-bottom">
          <button
            type="button"
            aria-label="پیوست فایل — به‌زودی"
            title="به‌زودی"
            disabled
            style={{ opacity: 0.4, cursor: 'not-allowed' }}
          >
            <Paperclip size={17} />
          </button>
          <span style={{ fontSize: 10, color: 'var(--subtle)' }}>Shift+Enter برای خط جدید</span>
          <button
            type="button"
            className="composer-send"
            aria-label="ارسال"
            onClick={() => void send()}
            disabled={!input.trim() || loading}
          >
            <ArrowUp size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
