import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('GET /download/android', () => {
  it('serves the mirrored APK as a download', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apk-'));
    writeFileSync(join(dir, 'zohalpay.apk'), 'PK-test-bytes');
    vi.stubEnv('ANDROID_APK_PATH', join(dir, 'zohalpay.apk'));
    const { GET } = await import('../../app/download/android/route');
    const res = GET(new Request('http://localhost/download/x'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/vnd.android.package-archive');
    expect(res.headers.get('content-length')).toBe('13');
    expect(await res.text()).toBe('PK-test-bytes');
  });

  it('serves the same app as a zip with ?format=zip', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apk-'));
    writeFileSync(join(dir, 'zohalpay.apk'), 'PK-test-bytes');
    writeFileSync(join(dir, 'zohalpay.zip'), 'PK-zip-bytes');
    vi.stubEnv('ANDROID_APK_PATH', join(dir, 'zohalpay.apk'));
    vi.resetModules();
    const { GET } = await import('../../app/download/android/route');
    const res = GET(new Request('http://localhost/download/android?format=zip'));
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('zohalpay.zip');
    expect(await res.text()).toBe('PK-zip-bytes');
  });

  it('says so in Persian when the app is not mirrored yet', async () => {
    vi.stubEnv('ANDROID_APK_PATH', '/nonexistent/zohalpay.apk');
    const { GET } = await import('../../app/download/android/route');
    const res = GET(new Request('http://localhost/download/x'));
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('فایل نصبی');
  });
});
