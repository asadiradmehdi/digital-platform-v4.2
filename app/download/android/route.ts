import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';

// The Android app, served from our own domain. GitHub release downloads stall for customers in Iran,
// so the server mirrors the newest release into /downloads (see deploy/update.sh).
const APK = process.env.ANDROID_APK_PATH ?? '/downloads/zohalpay.apk';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const zip = new URL(request.url).searchParams.get('format') === 'zip';
  const file = zip ? APK.replace(/\.apk$/, '.zip') : APK;
  let size: number;
  try {
    size = statSync(file).size;
  } catch {
    return new Response('فایل نصبی اپ هنوز آماده نیست. چند دقیقه دیگر دوباره تلاش کنید.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '120' },
    });
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, {
    headers: {
      'content-type': zip ? 'application/zip' : 'application/vnd.android.package-archive',
      'content-length': String(size),
      'content-disposition': `attachment; filename="zohalpay.${zip ? 'zip' : 'apk'}"`,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    },
  });
}
