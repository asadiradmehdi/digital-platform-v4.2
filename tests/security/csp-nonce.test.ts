/**
 * Regression: the CSP nonce was only on the response, so Next.js could not stamp it on its
 * own <script> tags and the browser blocked every script in production.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { buildCsp, middleware } from '../../middleware';

afterEach(() => vi.unstubAllEnvs());

describe('CSP middleware', () => {
  it('forwards the same nonce CSP to rendering (request) and to the browser (response)', () => {
    const res = middleware(new NextRequest('http://localhost/services'));
    const sent = res.headers.get('Content-Security-Policy') ?? '';
    const forwarded = res.headers.get('x-middleware-request-content-security-policy') ?? '';
    const nonce = /'nonce-([0-9a-f]+)'/.exec(sent)?.[1];
    expect(nonce).toBeTruthy();
    expect(forwarded).toContain(`'nonce-${nonce}'`);
    expect(res.headers.get('x-middleware-request-x-csp-nonce')).toBe(nonce);
  });
  it('never allows eval outside the local dev server', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(buildCsp('abc')).not.toContain('unsafe-eval');
    vi.stubEnv('NODE_ENV', 'test');
    expect(buildCsp('abc')).not.toContain('unsafe-eval');
    vi.stubEnv('NODE_ENV', 'development');
    expect(buildCsp('abc')).toContain("'unsafe-eval'");
  });
});
