import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteShell } from '../../components/site/SiteShell';
import { Mixed, Breadcrumbs, CtaBand, Facts, LdScript, SectionTitle, TrustStrip } from '../../components/site/bits';
import { BrandMark } from '../../components/zp/brand';
import { liveCategories } from '../../lib/seo/catalog-seo';
import { ENTITY_FACTS } from '../../lib/seo/entity';
import { breadcrumbLd, graph, organizationLd, webPageLd } from '../../lib/seo/jsonld';
import { absoluteUrl, metadataForPage, ogImage, siteConfig } from '../../lib/seo/site';
import { optionalViewer } from '../../server/account/page-context';
import { supportHours, supportPhones } from '../../server/content/trust';
import { getPublicCatalog } from '../../server/seo/public-catalog';

const TITLE = 'درباره‌ی زُحل پی (ZOHALPAY)';
const DESCRIPTION = 'زُحل پی (ZOHALPAY) فروشگاه آنلاین ایرانی خدمات رشد شبکه‌های اجتماعی و اشتراک هوش مصنوعی است؛ معرفی، شیوه‌ی کار، اصول قیمت‌گذاری و راه‌های ارتباط.';

export const metadata: Metadata = metadataForPage({ title: TITLE, description: DESCRIPTION, path: '/about', image: ogImage('/og/home.jpg', TITLE) });

export default async function AboutPage() {
  const [catalog, viewer] = await Promise.all([getPublicCatalog(), optionalViewer()]);
  const phones = supportPhones();
  const cats = liveCategories(catalog);
  const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
  const crumbs = [{ name: 'زُحل پی', path: '/' }, { name: 'درباره‌ی ما', path: '/about' }];
  const facts = [
    { k: 'نام', v: 'زُحل پی' },
    { k: 'نام لاتین', v: 'ZOHALPAY' },
    { k: 'حوزه', v: 'خدمات رشد شبکه‌های اجتماعی و اشتراک هوش مصنوعی' },
    { k: 'بازار', v: 'ایران · رابط کاملاً فارسی' },
    { k: 'خدمات فعال', v: `${fa(catalog.length)} سرویس در ${fa(cats.length)} دسته` },
    { k: 'واحد قیمت', v: 'تومان، برای هر واحد مشخص' },
    { k: 'پرداخت', v: 'آنلاین، از کیف پول زُحل پی' },
    { k: 'پشتیبانی', v: `تیکت · ${supportHours()}` },
  ];

  return (
    <SiteShell signedIn={Boolean(viewer)} catalog={catalog}>
      <LdScript data={graph(
        organizationLd({ phones }),
        webPageLd({ path: '/about', name: TITLE, description: DESCRIPTION, type: 'AboutPage' }),
        breadcrumbLd(crumbs),
      )} />
      <Breadcrumbs items={crumbs} />

      <section className="zs-phero" aria-labelledby="about-h1">
        <span className="zp-tile zp-btile" style={{ '--s': '64px' } as React.CSSProperties}><BrandMark id="about-mark" size={40} /></span>
        <div className="t">
          <h1 id="about-h1">درباره‌ی زُحل پی</h1>
          <p className="lead"><Mixed text={`${ENTITY_FACTS.what} ${ENTITY_FACTS.platforms}`} /></p>
        </div>
      </section>

      <Facts facts={facts} title="مشخصات زُحل پی" />

      <section className="zs-entity" aria-labelledby="what">
        <SectionTitle id="what">زُحل پی چه می‌کند؟</SectionTitle>
        <p><Mixed text={ENTITY_FACTS.ai} /></p>
        <p>{ENTITY_FACTS.ordering} {ENTITY_FACTS.pricing}</p>
        <p>{ENTITY_FACTS.tracking} {ENTITY_FACTS.support}</p>
      </section>

      <section className="zs-entity" aria-labelledby="principles">
        <SectionTitle id="principles">اصول کار ما</SectionTitle>
        <p><b>قیمت شفاف:</b> قیمت هر سرویس روی صفحه‌ی همان سرویس منتشر شده و مبلغ کل پیش از پرداخت نمایش داده می‌شود؛ هزینه‌ی پنهان وجود ندارد.</p>
        <p><b>بدون رمز عبور:</b> {ENTITY_FACTS.noPassword}</p>
        <p><b>حساب امن:</b> ورود دومرحله‌ای و مدیریت نشست‌ها و دستگاه‌ها از بخش تنظیمات امنیت حساب در دسترس است.</p>
        <p><b>ادعای بی‌پشتوانه نداریم:</b> هر مجوز فقط وقتی «فعال» نمایش داده می‌شود که از سایت رسمی صادرکننده قابل استعلام باشد. <Link href="/licenses">مجوزها و نمادها</Link></p>
      </section>

      <section className="zs-entity" aria-labelledby="name">
        <SectionTitle id="name">چرا «زُحل»؟</SectionTitle>
        <p>زُحل نام فارسی سیاره‌ی کیوان (Saturn) است. حلقه‌های زُحل در نشان ما دیده می‌شوند و سطح‌های وفاداری مشتریان هم به نام قمرهای زُحل، مثل میماس، تتیس و تایتان، نام‌گذاری شده‌اند.</p>
      </section>

      <section aria-labelledby="contact">
        <SectionTitle id="contact">راه‌های ارتباط</SectionTitle>
        <p className="zs-p">
          پشتیبانی از طریق تیکت در حساب کاربری انجام می‌شود ({supportHours()}).
          {phones.map(p => <span key={p.tel}> {p.label}: <a href={`tel:${p.tel}`} className="zp-ltr">{p.display}</a>.</span>)}
          {' '}<Link href="/contact">صفحه‌ی تماس</Link> · وب‌سایت رسمی: <span className="zp-ltr">{absoluteUrl('/').replace(/\/$/, '')}</span>
        </p>
      </section>

      <TrustStrip />
      <CtaBand title={`شروع با ${siteConfig.name}`} text="ثبت‌نام رایگان است؛ قیمت هر سرویس را پیش از پرداخت می‌بینید." href={viewer ? '/dashboard' : '/auth?mode=register'} label={viewer ? 'رفتن به حساب' : 'ثبت‌نام رایگان'} />
    </SiteShell>
  );
}
