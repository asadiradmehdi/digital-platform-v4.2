'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ZIcon, type IconName } from './ZIcon';
import { Ornament } from './brand';

export type PromoSlide = { kicker: string; title: string; text: string; icon: IconName; href: string; tone?: 'light' | 'tq'; goldTile?: boolean };

/** Auto-advancing promo carousel; swipe on touch, dots for keyboard/mouse. Pauses for reduced motion. */
export function Promo({ slides }: { slides: PromoSlide[] }) {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => {
    if (n < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI(v => (v + 1) % n), 4600);
    return () => clearInterval(t);
  }, [n, i]);

  return (
    <div
      className={`zp-promo${slides[i]?.tone === 'light' ? ' lt' : ''}`}
      onTouchStart={e => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (startX.current == null) return;
        const d = e.changedTouches[0].clientX - startX.current; startX.current = null;
        if (Math.abs(d) > 40) setI(v => (v + (d > 0 ? 1 : -1) + n) % n);
      }}
    >
      <div className="zp-track" style={i ? { transform: `translateX(${i * 100}%)` } : undefined}>
        {slides.map((s, k) => (
          <Link key={s.href + k} href={s.href} className={`zp-slide${s.tone ? ` ${s.tone}` : ''}`} tabIndex={k === i ? 0 : -1} aria-hidden={k !== i}>
            <Ornament id={`promo-${k}`} w={400} h={160} cx={300} cy={150} rot={-12} color={s.tone === 'light' ? '#7a5218' : '#f2d390'} />
            <span className="tx"><small>{s.kicker}</small><b>{s.title}</b><span>{s.text}</span></span>
            <span className="zp-emb"><span className={`zp-tile${s.goldTile ? ' gold' : ''}`}><ZIcon name={s.icon} /></span></span>
          </Link>
        ))}
      </div>
      <div className="zp-dots">
        {slides.map((_, k) => (
          <button key={k} type="button" aria-label={`اسلاید ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} />
        ))}
      </div>
    </div>
  );
}
