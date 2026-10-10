'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { bestSellers, searchServices } from '@digital-platform/api-contracts';
import { Tile } from '../../components/zp/brand';
import { ZIcon, type IconName } from '../../components/zp/ZIcon';
import { EmptyState } from '../../components/zp/cards';
import '../../components/zp/help.css';

type Svc = { slug: string; name: string; short: string; description: string | null; category: string; group: string; unit: string; per: number; unitPriceToman: number; perLabel: string; icon: IconName };
type Catalog = { categories: Array<{ key: string; name: string; hint?: string }>; services: Svc[] };
const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

/** Search over the live catalogue; with nothing typed it lists the best sellers first. */
export function SearchClient() {
  const [q, setQ] = useState('');
  const [state, setState] = useState<{ status: 'loading' | 'error' | 'ok'; catalog?: Catalog }>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch('/api/v1/app/catalog', { credentials: 'same-origin' })
      .then(r => (r.ok ? (r.json() as Promise<Catalog>) : Promise.reject(new Error('http'))))
      .then(catalog => { if (alive) setState({ status: 'ok', catalog }); })
      .catch(() => { if (alive) setState({ status: 'error' }); });
    return () => { alive = false; };
  }, [tick]);

  const c = state.catalog;
  const typed = q.trim().length > 0;
  const list = c ? (typed ? searchServices(c, q) : bestSellers(c, 8)) : [];
  const catName = (key: string) => c?.categories.find(x => x.key === key)?.name ?? '';
  return (
    <div className="zp-search">
      <label className="zp-search-box">
        <ZIcon name="search" />
        <input value={q} onChange={e => setQ(e.target.value)} autoFocus type="search" enterKeyHint="search" placeholder="مثلاً فالوور اینستاگرام یا چت‌جی‌پی‌تی" aria-label="جستجوی خدمات" />
      </label>
      {state.status === 'loading' ? <p role="status" style={{ color: 'var(--muted)', fontSize: 13 }}>در حال دریافت خدمات…</p>
        : state.status === 'error' ? <EmptyState icon="info" title="ارتباط برقرار نشد" text="دریافت خدمات انجام نشد." action={{ href: '/search', label: 'تلاش دوباره' }} />
        : typed && !list.length ? <EmptyState icon="search" title="چیزی پیدا نشد" text="عبارت دیگری امتحان کنید، مثلاً نام شبکه یا نوع خدمت؛ یا از پشتیبانی بپرسید." action={{ href: '/support', label: 'پشتیبانی' }} />
        : (
          <div className="zp-search-list" role="list" aria-label={typed ? 'نتیجه‌ها' : 'پرفروش‌ترین‌ها'}>
            <b style={{ fontSize: 12, color: 'var(--gold-text)' }}>{typed ? 'نتیجه‌ها' : 'پرفروش‌ترین‌ها'}</b>
            {list.map(s => (
              <Link key={s.slug} role="listitem" href={`/orders/new?service=${encodeURIComponent(s.slug)}`} className="zp-srow zp-press">
                <Tile icon={s.icon} />
                <span className="tx"><b>{s.name}</b><small>{catName(s.category)} · {s.perLabel}</small></span>
                <span className="pr"><b>{fa(s.unitPriceToman * s.per)}</b><small>تومان</small></span>
              </Link>
            ))}
          </div>
        )}
      {state.status === 'error' ? <button type="button" className="zp-cta zp-press" onClick={() => { setState({ status: 'loading' }); setTick(t => t + 1); }}>تلاش دوباره</button> : null}
    </div>
  );
}
