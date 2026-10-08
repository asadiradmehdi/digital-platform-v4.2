import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertSameOrigin } from '../../server/core/security-boundary';

// Regression: behind Caddy/nginx the app sees http://127.0.0.1:3000 while the browser sends the public https origin.
const post = (headers: Record<string, string>) => new Request('http://127.0.0.1:3000/api/v1/auth/register', { method: 'POST', headers });

describe('assertSameOrigin behind a TLS proxy', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('accepts the configured public origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://46-249-101-76.sslip.io');
    expect(() => assertSameOrigin(post({ origin: 'https://46-249-101-76.sslip.io' }))).not.toThrow();
    expect(() => assertSameOrigin(post({ referer: 'https://46-249-101-76.sslip.io/auth' }))).not.toThrow();
  });

  it('still rejects any other origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://46-249-101-76.sslip.io');
    expect(() => assertSameOrigin(post({ origin: 'https://evil.example' }))).toThrow(/Cross-origin/);
    expect(() => assertSameOrigin(post({ origin: 'http://46-249-101-76.sslip.io' }))).toThrow(/Cross-origin/);
    expect(() => assertSameOrigin(post({ referer: 'https://evil.example/x' }))).toThrow(/Origin header required/);
  });

  it('ignores a malformed site URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'not a url');
    expect(() => assertSameOrigin(post({ origin: 'https://46-249-101-76.sslip.io' }))).toThrow(/Cross-origin/);
  });
});
