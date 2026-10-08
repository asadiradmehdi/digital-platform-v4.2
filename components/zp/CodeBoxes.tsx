'use client';
import { useRef } from 'react';
import { toAsciiDigits } from '../../packages/api-contracts/src/phone';

const faNum = (n: number) => n.toLocaleString('fa-IR');

/** Six boxes backed by real inputs; the first carries autocomplete="one-time-code" so SMS autofill lands there. */
export function CodeBoxes({ value, onChange, disabled, invalid }: { value: string; onChange: (v: string) => void; disabled?: boolean; invalid?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const set = (from: number, raw: string) => {
    const digits = toAsciiDigits(raw).replace(/\D/g, '');
    if (!digits) return;
    const next = (value.slice(0, from) + digits).slice(0, 6);
    onChange(next);
    refs.current[Math.min(next.length, 5)]?.focus();
  };
  return (
    <div className="zp-otp" dir="ltr" role="group" aria-label="کد ۶ رقمی">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          className={invalid ? 'bad' : undefined}
          value={value[i] ?? ''}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          name={i === 0 ? 'code' : undefined}
          aria-label={`رقم ${faNum(i + 1)}`}
          maxLength={i === 0 ? 6 : 1}
          disabled={disabled}
          autoFocus={i === 0}
          onFocus={e => e.currentTarget.select()}
          onChange={e => {
            const v = e.currentTarget.value;
            if (!v) { onChange(value.slice(0, i) + value.slice(i + 1)); return; }
            // Typing over a filled box yields two characters; keep the new one. Longer input is autofill/paste.
            set(i, v.length === 2 && value[i] ? v.replace(value[i], '').slice(-1) || v.slice(-1) : v);
          }}
          onPaste={e => { e.preventDefault(); set(0, e.clipboardData.getData('text')); }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !value[i] && i > 0) { onChange(value.slice(0, i - 1)); refs.current[i - 1]?.focus(); }
            if (e.key === 'ArrowLeft' && i < 5) refs.current[i + 1]?.focus();
            if (e.key === 'ArrowRight' && i > 0) refs.current[i - 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
