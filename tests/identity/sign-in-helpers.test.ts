import { describe, expect, it, vi } from 'vitest';
vi.mock('../../server/core/db', () => ({ query: vi.fn(), withTenantTransaction: vi.fn(), withUserTransaction: vi.fn() }));
import { describeUserAgent, readMobileDevice, safeNextPath } from '../../server/identity/sign-in';
import { readBoundedBody } from '../../server/core/body';

describe('post-sign-in destination', () => {
  it.each([
    ['/orders/1', '/orders/1'], ['/dashboard?x=1', '/dashboard?x=1'],
    ['//evil.example', '/dashboard'], ['https://evil.example', '/dashboard'], ['/\\evil.example', '/dashboard'],
    ['/auth?next=/x', '/dashboard'], ['/api/v1/auth/logout', '/dashboard'], [undefined, '/dashboard'], ['javascript:alert(1)', '/dashboard'],
    // Regression: public service pages link to /auth?mode=register&next=/orders/new?service=…
    ['/orders/new?service=instagram-followers', '/orders/new?service=instagram-followers'], ['/authors', '/authors'],
    ['\\evil.example', '/dashboard'], ['/\t/evil.example', '/dashboard'], ['http:/evil.example', '/dashboard'], ['', '/dashboard'], ['/auth/x', '/dashboard'],
  ])('%s → %s', (input, out) => expect(safeNextPath(input)).toBe(out));
});

describe('device labels and mobile device input', () => {
  it('labels common browsers', () => {
    expect(describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari/604.1')).toBe('Safari — iOS');
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537')).toBe('Chrome — Windows');
  });
  it('requires a platform and a long enough device id', () => {
    expect(() => readMobileDevice({ platform: 'web', deviceId: 'x'.repeat(20) })).toThrow();
    expect(() => readMobileDevice({ platform: 'ios', deviceId: 'short' })).toThrow();
    expect(readMobileDevice({ platform: 'android', deviceId: 'd'.repeat(36), deviceName: 'Pixel' })).toMatchObject({ platform: 'ANDROID', deviceName: 'Pixel' });
  });
});

describe('bounded body reader', () => {
  it('rejects oversized bodies before parsing (declared or streamed)', async () => {
    const big = JSON.stringify({ phone: 'x'.repeat(5000) });
    await expect(readBoundedBody(new Request('http://x/', { method: 'POST', body: big, headers: { 'content-type': 'application/json' } }), 2048)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(readBoundedBody(new Request('http://x/', { method: 'POST', body: big, headers: { 'content-type': 'application/json', 'content-length': '10' } }), 2048)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('parses JSON objects and urlencoded forms, and refuses arrays', async () => {
    expect(await readBoundedBody(new Request('http://x/', { method: 'POST', body: '{"a":1}', headers: { 'content-type': 'application/json' } }))).toEqual({ a: 1 });
    expect(await readBoundedBody(new Request('http://x/', { method: 'POST', body: 'a=1&b=2', headers: { 'content-type': 'application/x-www-form-urlencoded' } }))).toEqual({ a: '1', b: '2' });
    await expect(readBoundedBody(new Request('http://x/', { method: 'POST', body: '[1]', headers: { 'content-type': 'application/json' } }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
