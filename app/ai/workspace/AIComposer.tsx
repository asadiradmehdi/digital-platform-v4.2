'use client';
import { useRef, useState } from 'react';
import {
  ArrowUp, Bot, ChevronDown, Code2, ImageIcon,
  Paperclip, Plus, Search, Sparkles, Zap,
} from 'lucide-react';

const STARTERS = [
  {
    icon: Sparkles,
    label: 'کپشن اینستاگرام',
    prompt: 'پنج کپشن فارسی برای معرفی یک محصول دیجیتال جدید در اینستاگرام بنویس. لحن گرم و جذاب باشد.',
  },
  {
    icon: Code2,
    label: 'خلاصه گزارش مالی',
    prompt: 'یک گزارش عملکرد ماهانه کسب‌وکار را با اعداد فرضی بنویس که شامل درآمد، هزینه و رشد باشد.',
  },
  {
    icon: Search,
    label: 'تحلیل رقبا',
    prompt: 'یک قالب برای تحلیل رقبا در صنعت خدمات دیجیتال بساز. شامل: ویژگی‌ها، قیمت‌گذاری، نقاط ضعف.',
  },
  {
    icon: Bot,
    label: 'ایمیل فروش فارسی',
    prompt: 'یک ایمیل فروش کوتاه و حرفه‌ای فارسی بنویس برای معرفی یک سرویس اتوماسیون به مدیر یک کسب‌وکار.',
  },
  {
    icon: ImageIcon,
    label: 'توضیح برای تصویر',
    prompt: 'یک توضیح کامل برای تصویر محصول الکترونیکی بنویس که هم برای مشتری جذاب باشد هم برای موتور جستجو.',
  },
  {
    icon: Zap,
    label: 'برنامه محتوا هفتگی',
    prompt: 'یک برنامه محتوای هفتگی برای یک برند فناوری در شبکه‌های اجتماعی طراحی کن.',
  },
];

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku', badge: 'سریع' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet', badge: 'متعادل' },
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
          <h2>چه می‌خواهید بنویسید؟</h2>
          <p>درخواست خود را تایپ کنید یا یکی از موضوعات پیشنهادی را انتخاب کنید.</p>
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
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>در حال پاسخ‌دهی</span>
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
          placeholder="مثلاً: یک ایمیل فارسی برای معرفی سرویس جدیدمان به مشتریان بنویس..."
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
