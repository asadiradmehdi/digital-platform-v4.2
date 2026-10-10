import { NextRequest } from 'next/server';
import { AppError } from '../../../../../../server/core/errors';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { LEGAL_DOCS, isLegalKey } from '../../../../../../lib/legal-content';

/** Terms, privacy policy and about text for the native app: the same content the website shows. No session needed. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ doc: string }> }) {
  const id = correlationId(request);
  try {
    const { doc } = await params;
    if (!isLegalKey(doc)) throw new AppError('NOT_FOUND', 'سند پیدا نشد.');
    return json({ doc: LEGAL_DOCS[doc] }, { correlationId: id, headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (error) { return handleRouteError(error, id); }
}
