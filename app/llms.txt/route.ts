import { buildLlmsTxt } from '../../lib/seo/llms';
import { getPublicCatalog } from '../../server/seo/public-catalog';

// llms.txt (llmstxt.org): a short, factual briefing for AI answer engines, built from the live catalogue.
export const dynamic = 'force-dynamic';

export async function GET() {
  const body = buildLlmsTxt(await getPublicCatalog());
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600' },
  });
}
