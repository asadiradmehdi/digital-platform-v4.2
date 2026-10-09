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
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/vnd.android.package-archive');
    expect(res.headers.get('content-length')).toBe('13');
    expect(await res.text()).toBe('PK-test-bytes');
  });

  it('says so in Persian when the app is not mirrored yet', async () => {
    vi.stubEnv('ANDROID_APK_PATH', '/nonexistent/zohalpay.apk');
    const { GET } = await import('../../app/download/android/route');
    const res = GET();
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('فایل نصبی');
  });
});
