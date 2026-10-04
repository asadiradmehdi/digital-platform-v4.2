/**
 * Rate limit guard on POST /api/v1/auth/recovery-codes.
 * Verifies that the route enforces consumeDistributedRateLimit before
 * regenerating recovery codes, preventing brute-force abuse.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve(process.cwd(), 'app/api/v1/auth/recovery-codes/route.ts');
const src = readFileSync(routePath, 'utf-8');

describe('POST /api/v1/auth/recovery-codes — rate limiting', () => {
  it('imports consumeDistributedRateLimit', () => {
    expect(src).toContain('consumeDistributedRateLimit');
    expect(src).toContain('distributed-rate-limit');
  });

  it('calls consumeDistributedRateLimit inside POST handler', () => {
    // The call must appear in the POST function body, not just imported
    const postFnIndex = src.indexOf('export async function POST');
    expect(postFnIndex).toBeGreaterThan(-1);
    const postBody = src.slice(postFnIndex);
    expect(postBody).toContain('consumeDistributedRateLimit');
  });

  it('limits by IP fingerprint', () => {
    const postFnIndex = src.indexOf('export async function POST');
    const postBody = src.slice(postFnIndex);
    expect(postBody).toContain('clientFingerprint');
    // The rate-limit key must include the IP
    expect(postBody).toMatch(/key:\s*`recovery-codes:\$\{/);
  });

  it('uses auth.recovery scope', () => {
    expect(src).toContain('auth.recovery');
  });

  it('specifies a window and maxRequests', () => {
    expect(src).toContain('windowSeconds');
    expect(src).toContain('maxRequests');
  });

  it('rate limiting is called before regenerateRecoveryCodes', () => {
    const postBody = src.slice(src.indexOf('export async function POST'));
    const rateLimitPos = postBody.indexOf('consumeDistributedRateLimit');
    const regeneratePos = postBody.indexOf('regenerateRecoveryCodes');
    expect(rateLimitPos).toBeGreaterThan(-1);
    expect(regeneratePos).toBeGreaterThan(-1);
    expect(rateLimitPos).toBeLessThan(regeneratePos);
  });
});

describe('POST /api/v1/auth/register — rate limiting', () => {
  it('imports and calls consumeDistributedRateLimit', () => {
    const registerSrc = readFileSync(
      resolve(process.cwd(), 'app/api/v1/auth/register/route.ts'),
      'utf-8',
    );
    expect(registerSrc).toContain('consumeDistributedRateLimit');
    expect(registerSrc).toContain('auth.register');
  });
});

describe('POST /api/v1/auth/mfa/challenge — rate limiting', () => {
  it('imports and calls consumeDistributedRateLimit', () => {
    const mfaSrc = readFileSync(
      resolve(process.cwd(), 'app/api/v1/auth/mfa/challenge/route.ts'),
      'utf-8',
    );
    expect(mfaSrc).toContain('consumeDistributedRateLimit');
    expect(mfaSrc).toContain('auth.mfa');
  });
});
