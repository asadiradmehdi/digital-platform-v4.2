import { AppError } from './errors';

/**
 * Reads a small request body with a hard byte ceiling enforced BEFORE parsing (declared Content-Length is
 * checked first, then the stream is cut off at the limit). Accepts JSON or urlencoded/multipart forms.
 */
export async function readBoundedBody(request: Request, maxBytes = 4096): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new AppError('VALIDATION_ERROR', 'درخواست بیش از حد بزرگ است.');
  const text = await readText(request, maxBytes);
  const type = request.headers.get('content-type') ?? '';
  if (!text) return {};
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text).entries());
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new AppError('VALIDATION_ERROR', 'بدنه‌ی درخواست معتبر نیست.');
  }
}

export async function readText(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new AppError('VALIDATION_ERROR', 'درخواست بیش از حد بزرگ است.');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
