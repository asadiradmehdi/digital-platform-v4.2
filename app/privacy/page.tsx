import type { Metadata } from 'next';
import { PublicPage } from '../../components/seo/PublicPage';
import { LEGAL_DOCS } from '../../lib/legal-content';

const doc = LEGAL_DOCS.privacy;
const sections = doc.sections;

export const metadata: Metadata = {
  title: 'حریم خصوصی',
  description: 'سیاست حریم خصوصی ZOHALPAY — جمع‌آوری، پردازش، نگهداری و حقوق داده.',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: true },
};

export default function Privacy() {
  return (
    <PublicPage
      eyebrow="LEGAL"
      title="حریم خصوصی"
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
