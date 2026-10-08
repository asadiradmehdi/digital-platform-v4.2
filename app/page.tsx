import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandTile, Ornament, Tile } from '../components/zp/brand';
import { ZIcon } from '../components/zp/ZIcon';
import { SiteShell } from '../components/site/SiteShell';
import { Mixed, CtaBand, FaqList, LdScript, SectionTitle, ServiceLinkCard, Steps, TrustStrip } from '../components/site/bits';
import { CATEGORIES, serviceBrand } from '../lib/catalog-ui';
import { fromPrice, listPrice, serviceHref } from '../lib/seo/catalog-seo';
import { ENTITY_FACTS, homeFaq } from '../lib/seo/entity';
import { faqLd, graph, organizationLd, webPageLd, websiteLd } from '../lib/seo/jsonld';
import { metadataForPage, siteConfig } from '../lib/seo/site';
import { optionalViewer } from '../server/account/page-context';
import { supportHours, supportPhones } from '../server/content/trust';
import { getPublicCatalog, type PublicService } from '../server/seo/public-catalog';

const TITLE = 'زُحل پی | خرید فالوور، ممبر و اشتراک هوش مصنوعی';
const DESCRIPTION = 'خرید فالوور، لایک و بازدید اینستاگرام، ممبر تلگرام، سابسکرایبر یوتیوب و اشتراک ChatGPT، Claude و Gemini با قیمت شفاف و پیگیری لحظه‌ای سفارش در زُحل پی (ZOHALPAY).';

export const metadata: Metadata = metadataForPage({ title: TITLE, description: DESCRIPTION, path: '/', absoluteTitle: true });

const POPULAR = ['ig-followers', 'ig-likes', 'ig-views', 'tg-members', 'yt-subscribers', 'tt-followers', 'ig-story-views', 'yt-views'];

export default async function Home() {
  const [catalog, viewer] = await Promise.all([getPublicCatalog(), optionalViewer()]);
  const signedIn = Boolean(viewer);
  const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
  const pick = (slug: string) => catalog.find(s => s.slug === slug);
  const popular = POPULAR.map(pick).filter((s): s is PublicService => Boolean(s));
  const ai = catalog.filter(s => s.category === 'ai-subscriptions' && serviceBrand(s.slug));
  const liveKeys = new Set(catalog.map(s => s.category));
  const cats = [...CATEGORIES.filter(c => liveKeys.has(c.key)), ...CATEGORIES.filter(c => !liveKeys.has(c.key))];
  const igFollowers = pick('ig-followers');
  const tgMembers = pick('tg-members');
  const chatgpt = pick('sub-chatgpt-plus');
  const faq = homeFaq(supportHours());
  const register = signedIn ? '/dashboard' : '/auth?mode=register';

  return (
    <SiteShell signedIn={signedIn} catalog={catalog}>
      <LdScript data={graph(
        organizationLd({ phones: supportPhones() }),
        websiteLd(),
        webPageLd({ path: '/', name: TITLE, description: DESCRIPTION }),
        faqLd(faq),
      )} />

      <section className="zs-hero" aria-labelledby="home-h1">
        <Ornament id="hero-orn" w={1200} h={520} cx={180} cy={470} rot={-14} alpha={0.85} />
        <div className="copy">
          <span className="kick">زُحل پی · خدمات رشد و اشتراک هوش مصنوعی</span>
          <h1 id="home-h1">خرید فالوور، لایک، ممبر و <em className="zp-gtext">اشتراک هوش مصنوعی</em></h1>
          <p><Mixed text="خدمات اینستاگرام، تلگرام، یوتیوب، تیک‌تاک، روبیکا، آپارات، بله و ایتا، و اشتراک ChatGPT، Claude و Gemini با پرداخت تومانی. قیمت هر سفارش پیش از پرداخت مشخص است و وضعیتش را لحظه‌به‌لحظه می‌بینید." /></p>
          <div className="acts">
            <Link href={register} className="zp-cta big zp-press">{signedIn ? 'رفتن به حساب' : 'ثبت‌نام رایگان'}<ZIcon name="chevL" /></Link>
            <Link href="/services" className="zs-ghost on-dark zp-press">قیمت خدمات</Link>
          </div>
          <ul className="chips" aria-label="شروع قیمت‌ها">
            {igFollowers && <li><Link href={serviceHref(igFollowers)}>فالوور اینستاگرام <b>{listPrice(igFollowers).perLabel} {listPrice(igFollowers).text}</b> تومان</Link></li>}
            {tgMembers && <li><Link href={serviceHref(tgMembers)}>ممبر تلگرام <b>{listPrice(tgMembers).perLabel} {listPrice(tgMembers).text}</b> تومان</Link></li>}
            {chatgpt && <li><Link href={serviceHref(chatgpt)}>ChatGPT Plus <b>ماهانه {listPrice(chatgpt).text}</b> تومان</Link></li>}
          </ul>
        </div>
        <div className="art" aria-hidden="true">
          {CATEGORIES.slice(0, 9).map((c, i) => <span key={c.key} style={{ '--i': i } as React.CSSProperties}><Tile icon={c.icon} gold={i === 4} /></span>)}
        </div>
      </section>

      <section aria-labelledby="cats">
        <SectionTitle id="cats" note={`${fa(catalog.length)} سرویس فعال`}>دسته‌های خدمات</SectionTitle>
        <nav className="zs-cats" aria-label="دسته‌های خدمات">
          {cats.map(c => {
            const from = fromPrice(catalog, c.key);
            const soon = !liveKeys.has(c.key);
            return (
              <Link key={c.key} href={`/services/${c.key}`} className={`zp-press${soon ? ' soon' : ''}`}>
                <Tile icon={c.icon} />
                <b>{c.name}</b>
                <small>{soon ? 'به‌زودی' : from ? `از ${from.text} تومان` : ''}</small>
              </Link>
            );
          })}
        </nav>
      </section>

      {popular.length > 0 && (
        <section aria-labelledby="popular">
          <SectionTitle id="popular" note={<Link href="/services">همه‌ی خدمات</Link>}>پرطرفدارترین سرویس‌ها</SectionTitle>
          <div className="zs-svcs">{popular.map(s => <ServiceLinkCard key={s.slug} service={s} showCategory />)}</div>
        </section>
      )}

      {ai.length > 0 && (
        <section className="zs-ai" aria-labelledby="ai-subs">
          <SectionTitle id="ai-subs" note={<Link href="/services/ai-subscriptions">همه‌ی اشتراک‌ها</Link>}>اشتراک هوش مصنوعی با پرداخت تومانی</SectionTitle>
          <p className="zs-p"><Mixed text={ENTITY_FACTS.ai} /></p>
          <ul>
            {ai.map(s => {
              const brand = serviceBrand(s.slug)!;
              return (
                <li key={s.slug}>
                  <Link href={serviceHref(s)} className="zp-press">
                    <BrandTile brand={brand} />
                    <b className="zp-ltr">{s.name}</b>
                    <small>ماهانه {listPrice(s).text} تومان</small>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="how">
        <SectionTitle id="how">خرید از زُحل پی در ۴ قدم</SectionTitle>
        <Steps steps={[
          { t: 'ثبت‌نام رایگان', d: 'ساخت حساب فقط چند ثانیه طول می‌کشد.' },
          { t: 'شارژ کیف پول', d: 'پرداخت آنلاین؛ موجودی همیشه در حساب‌تان پیداست.' },
          { t: 'انتخاب سرویس و تعداد', d: 'لینک یا نام کاربری را وارد کنید؛ رمز عبور لازم نیست.' },
          { t: 'پیگیری لحظه‌ای', d: 'مرحله‌ی هر سفارش را در بخش «سفارش‌ها» می‌بینید.' },
        ]} />
      </section>

      <section aria-labelledby="trust">
        <SectionTitle id="trust" note={<Link href="/licenses">مجوزها و نمادها</Link>}>چرا زُحل پی؟</SectionTitle>
        <TrustStrip />
      </section>

      <section className="zs-entity" aria-labelledby="glance">
        <SectionTitle id="glance">زُحل پی در یک نگاه</SectionTitle>
        <p><Mixed text={`${ENTITY_FACTS.what} ${ENTITY_FACTS.platforms}`} /></p>
        <p><Mixed text={`${ENTITY_FACTS.pricing} ${ENTITY_FACTS.noPassword}`} /></p>
        <p>{ENTITY_FACTS.tracking} <Link href="/about">بیشتر درباره‌ی {siteConfig.name}</Link></p>
      </section>

      <section aria-labelledby="faq-h">
        <SectionTitle id="faq-h">سؤالات متداول</SectionTitle>
        <FaqList faq={faq} />
      </section>

      <CtaBand title="همین حالا شروع کنید" text="ثبت‌نام رایگان است؛ قیمت هر سرویس را پیش از پرداخت می‌بینید." href={register} label={signedIn ? 'رفتن به حساب' : 'ثبت‌نام رایگان'} />
    </SiteShell>
  );
}
