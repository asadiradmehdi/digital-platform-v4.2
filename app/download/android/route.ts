import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';

// The Android app, served from our own domain. GitHub release downloads stall for customers in Iran,
// so the server mirrors the newest release into /downloads (see deploy/update.sh).
const APK = process.env.ANDROID_APK_PATH ?? '/downloads/zohalpay.apk';

export const dynamic = 'force-dynamic';

export function GET() {
  let size: number;
  try {
    size = statSync(APK).size;
  } catch {
    return new Response('فایل نصبی اپ هنوز آماده نیست. چند دقیقه دیگر دوباره تلاش کنید.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '120' },
    });
  }
  const body = Readable.toWeb(createReadStream(APK)) as ReadableStream;
  return new Response(body, {
    headers: {
      'content-type': 'application/vnd.android.package-archive',
      'content-length': String(size),
      'content-disposition': 'attachment; filename="zohalpay.apk"',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    },
  });
}
