import { buildLlmsFullTxt } from '../../lib/seo/llms';
import { supportHours } from '../../server/content/trust';
import { getPublicCatalog } from '../../server/seo/public-catalog';

// llms-full.txt: every public service with its live price, limits and canonical URL, plus the FAQ.
export const dynamic = 'force-dynamic';

export async function GET() {
  const body = buildLlmsFullTxt(await getPublicCatalog(), supportHours());
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600' },
  });
}
