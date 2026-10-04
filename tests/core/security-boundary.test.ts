import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertSameOrigin, clientFingerprint } from '../../server/core/security-boundary';

function makeRequest(method: string, url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { method, headers });
}

describe('assertSameOrigin', () => {
  it('allows GET requests without any origin check', () => {
    expect(() => assertSameOrigin(makeRequest('GET', 'https://app.example.com/api/v1/me'))).not.toThrow();
  });

  it('allows POST with matching origin header', () => {
    const req = makeRequest('POST', 'https://app.example.com/api/v1/data', {
      origin: 'https://app.example.com',
    });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it('throws FORBIDDEN on POST with mismatched origin', () => {
    const req = makeRequest('POST', 'https://app.example.com/api/v1/data', {
      origin: 'https://evil.example.com',
    });
    expect(() => assertSameOrigin(req)).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('allows POST with matching referer when origin is absent', () => {
    const req = makeRequest('POST', 'https://app.example.com/api/v1/data', {
      referer: 'https://app.example.com/some/page',
    });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it('throws FORBIDDEN when no origin/referer and no authorization header', () => {
    const req = makeRequest('DELETE', 'https://app.example.com/api/v1/resource');
    expect(() => assertSameOrigin(req)).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('allows POST without origin when authorization header is present', () => {
    const req = makeRequest('PATCH', 'https://app.example.com/api/v1/data', {
      authorization: 'Bearer dp_live_abc',
    });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it('applies to PATCH and DELETE methods', () => {
    const patch = makeRequest('PATCH', 'https://app.example.com/api/v1/x', { origin: 'https://evil.com' });
    const del = makeRequest('DELETE', 'https://app.example.com/api/v1/x', { origin: 'https://evil.com' });
    expect(() => assertSameOrigin(patch)).toThrow();
    expect(() => assertSameOrigin(del)).toThrow();
  });
});

describe('clientFingerprint', () => {
  const originalEnv = process.env.TRUST_PROXY;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalEnv;
  });

  it('returns unknown when no IP headers present (TRUST_PROXY not set)', () => {
    delete process.env.TRUST_PROXY;
    const req = makeRequest('GET', 'https://example.com/');
    expect(clientFingerprint(req)).toBe('unknown');
  });

  it('returns x-real-ip value when TRUST_PROXY=true', () => {
    process.env.TRUST_PROXY = 'true';
    const req = makeRequest('GET', 'https://example.com/', { 'x-real-ip': '1.2.3.4' });
    expect(clientFingerprint(req)).toBe('1.2.3.4');
  });

  it('returns first x-forwarded-for IP when TRUST_PROXY=true', () => {
    process.env.TRUST_PROXY = 'true';
    const req = makeRequest('GET', 'https://example.com/', { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' });
    expect(clientFingerprint(req)).toBe('5.6.7.8');
  });

  it('ignores forwarded headers when TRUST_PROXY is not true', () => {
    process.env.TRUST_PROXY = 'false';
    const req = makeRequest('GET', 'https://example.com/', { 'x-real-ip': '1.2.3.4' });
    expect(clientFingerprint(req)).toBe('unknown');
  });

  it('truncates IP to 128 chars', () => {
    process.env.TRUST_PROXY = 'true';
    const longIp = 'a'.repeat(200);
    const req = makeRequest('GET', 'https://example.com/', { 'x-real-ip': longIp });
    expect(clientFingerprint(req)).toHaveLength(128);
  });
});
