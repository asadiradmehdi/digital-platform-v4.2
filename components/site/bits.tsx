// Building blocks for the public catalogue pages. Server components (no hooks), v6 tokens only.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandTile, Tile } from '../zp/brand';
import { ZIcon, type IconName } from '../zp/ZIcon';
import { JsonLd } from '../seo/JsonLd';
import { categoryMeta, serviceBrand, serviceIcon, shortServiceName } from '../../lib/catalog-ui';
import { formatQuantityWords, formatTomanNumber } from '../../lib/format';
import { listPrice, serviceHref, type Faq, type SeoService } from '../../lib/seo/catalog-seo';

const LATIN_RUN = /[A-Za-z][\w.+-]*(?:[ ][A-Za-z0-9][\w.+-]*)*/g;

/**
 * Persian text with Latin product names (ChatGPT، Claude، Gemini…) isolated one by one. Without this the
 * bidi algorithm merges «ChatGPT، Claude» into one LTR run and a right-to-left reader meets Claude first.
 */
export function Mixed({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LATIN_RUN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    out.push(<bdi key={i} dir="ltr">{m[0]}</bdi>);
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export function ServiceTile({ slug, size }: { slug: string; size?: number }) {
  const brand = serviceBrand(slug);
  return brand ? <BrandTile brand={brand} size={size} /> : <Tile icon={serviceIcon(slug)} size={size} />;
}

/** Visible breadcrumb trail (its BreadcrumbList JSON-LD is emitted by the page's @graph). */
export function Breadcrumbs({ items }: { items: Array<{ name: string; path: string }> }) {
  return (
    <nav className="zs-bc" aria-label="مسیر صفحه">
      <ol>
        {items.map((it, i) => (
          <li key={it.path}>
            {i < items.length - 1 ? <Link href={it.path}>{it.name}</Link> : <span aria-current="page">{it.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function SectionTitle({ id, children, note }: { id?: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="zs-sh">
      <h2 id={id}>{children}</h2>
      {note && <span>{note}</span>}
    </div>
  );
}

/** Live price list of a category: one row per service, linking to the service's own page. */
export function PriceTable({ services, categoryName, caption }: { services: SeoService[]; categoryName: string; caption: string }) {
  return (
    <div className="zs-tablewrap">
      <table className="zs-table">
        <caption>{caption}</caption>
        <thead>
          <tr><th scope="col">سرویس</th><th scope="col">واحد قیمت</th><th scope="col">قیمت (تومان)</th></tr>
        </thead>
        <tbody>
          {services.map(s => {
            const lp = listPrice(s);
            return (
              <tr key={s.slug}>
                <th scope="row">
                  <Link href={serviceHref(s)} className="zs-tname">
                    <ServiceTile slug={s.slug} size={34} />
                    <span>{shortServiceName(s.name, categoryName)}</span>
                  </Link>
                </th>
                <td className="u">{lp.perLabel}</td>
                <td className="p">{lp.text}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Ready-made packages of one service: quantity → total, exactly quantity × unit price. */
export function PackageTable({ service, quantities, unit, orderHref }: { service: SeoService; quantities: number[]; unit: string; orderHref: string }) {
  const months = unit === 'ماه';
  return (
    <div className="zs-tablewrap">
      <table className="zs-table pk">
        <caption>قیمت بسته‌های {service.name}</caption>
        <thead>
          <tr><th scope="col">{months ? 'مدت' : 'تعداد'}</th><th scope="col">قیمت کل (تومان)</th><th scope="col"><span className="zs-sr">سفارش</span></th></tr>
        </thead>
        <tbody>
          {quantities.map(q => (
            <tr key={q}>
              <th scope="row">{formatQuantityWords(q)} {unit}</th>
              <td className="p">{formatTomanNumber(q * service.unitToman)}</td>
              <td className="c"><Link href={orderHref} className="zs-mini" rel="nofollow">سفارش</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FaqList({ faq, id = 'faq' }: { faq: Faq[]; id?: string }) {
  return (
    <div className="zs-faq" id={id}>
      {faq.map((f, i) => (
        <details key={f.q} open={i === 0}>
          <summary><h3><Mixed text={f.q} /></h3><ZIcon name="chevL" className="zp-chev" /></summary>
          <p><Mixed text={f.a} /></p>
        </details>
      ))}
    </div>
  );
}

export function Steps({ steps }: { steps: Array<{ t: string; d: string }> }) {
  return (
    <ol className="zs-steps">
      {steps.map(s => <li key={s.t}><b>{s.t}</b><span>{s.d}</span></li>)}
    </ol>
  );
}

export function Facts({ facts, title }: { facts: Array<{ k: string; v: string }>; title: string }) {
  return (
    <section className="zs-facts" aria-label={title}>
      <dl>
        {facts.map(f => <div key={f.k}><dt>{f.k}</dt><dd><Mixed text={f.v} /></dd></div>)}
      </dl>
    </section>
  );
}

/** Compact card linking to a service page with its live list price. */
export function ServiceLinkCard({ service, showCategory = false }: { service: SeoService; showCategory?: boolean }) {
  const lp = listPrice(service);
  const cat = categoryMeta(service.category);
  const name = showCategory || !cat ? service.name : shortServiceName(service.name, cat.name);
  return (
    <Link href={serviceHref(service)} className="zs-scard zp-press">
      <ServiceTile slug={service.slug} />
      <span className="t">
        <b>{name}</b>
        <small>{lp.perLabel}</small>
      </span>
      <span className="p">{lp.text}<i>تومان</i></span>
    </Link>
  );
}

export function TrustStrip() {
  const items: Array<{ icon: IconName; t: string; d: ReactNode }> = [
    { icon: 'wallet', t: 'قیمت شفاف', d: 'مبلغ کل پیش از پرداخت؛ بدون هزینه‌ی پنهان' },
    { icon: 'hist', t: 'پیگیری لحظه‌ای', d: 'مرحله‌ی هر سفارش را در حساب‌تان می‌بینید' },
    { icon: 'shield', t: 'بدون رمز عبور', d: 'فقط لینک یا نام کاربری؛ رمز حساب‌تان را نمی‌خواهیم' },
    { icon: 'chat', t: 'پشتیبانی با تیکت', d: <>پیگیری هر مشکل از <Link href="/contact">راه‌های ارتباطی</Link></> },
  ];
  return (
    <ul className="zs-trust">
      {items.map(it => (
        <li key={it.t}><Tile icon={it.icon} size={42} /><span><b>{it.t}</b><small>{it.d}</small></span></li>
      ))}
    </ul>
  );
}

export function CtaBand({ title, text, href, label }: { title: string; text: string; href: string; label: string }) {
  return (
    <section className="zs-band">
      <div><h2>{title}</h2><p>{text}</p></div>
      <Link href={href} className="zp-cta big zp-press">{label}<ZIcon name="chevL" /></Link>
    </section>
  );
}

export function LdScript({ data }: { data: Record<string, unknown> }) {
  return <JsonLd data={data} />;
}
