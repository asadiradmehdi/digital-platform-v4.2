import type { Metadata } from 'next';
import { PublicPage } from '../../components/seo/PublicPage';
import { LEGAL_DOCS } from '../../lib/legal-content';

const doc = LEGAL_DOCS.terms;
const sections = doc.sections;

export const metadata: Metadata = {
  title: 'شرایط استفاده',
  description: 'قوانین و شرایط استفاده از خدمات زُحل پی؛ ثبت سفارش، پرداخت، بازگشت وجه و مسئولیت‌ها.',
  alternates: { canonical: '/terms' },
  robots: { index: false, follow: true },
};

export default function Terms() {
  return (
    <PublicPage
      eyebrow="LEGAL"
      title="شرایط استفاده"
      description={doc.summary}
    >
      <div className="public-info-card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--subtle)' }}>{doc.updatedLabel}{doc.version ? ` | نسخه‌ی ${doc.version}` : ''}</p>
      </div>
      <div className="public-list">
        {sections.map(({ title, lines }) => (
          <article key={title}>
            <h2>{title}</h2>
            {lines.map((line, i) => <p key={i} style={{ marginBottom: 4 }}>{line}</p>)}
          </article>
        ))}
      </div>
    </PublicPage>
  );
}
