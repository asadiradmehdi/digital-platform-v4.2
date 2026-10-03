import { describe, it, expect, vi, afterEach } from 'vitest';
import { signWebhook, verifyWebhookSignature } from '../../server/core/webhook';

afterEach(() => vi.restoreAllMocks());

describe('signWebhook', () => {
  it('returns a hex HMAC-SHA256 signature', () => {
    const sig = signWebhook('secret', '1700000000', 'payload');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for same inputs', () => {
    const a = signWebhook('s', '1700000000', 'body');
    const b = signWebhook('s', '1700000000', 'body');
    expect(a).toBe(b);
  });

  it('differs when secret changes', () => {
    const a = signWebhook('secret-a', '1700000000', 'body');
    const b = signWebhook('secret-b', '1700000000', 'body');
    expect(a).not.toBe(b);
  });

  it('differs when body changes', () => {
    const a = signWebhook('secret', '1700000000', 'body-a');
    const b = signWebhook('secret', '1700000000', 'body-b');
    expect(a).not.toBe(b);
  });
});

describe('verifyWebhookSignature', () => {
  it('returns true for a valid signature within the replay window', () => {
    const nowTs = Math.floor(Date.now() / 1000);
    const body = '{"event":"payment.paid"}';
    const sig = signWebhook('my-secret', String(nowTs), body);
    expect(verifyWebhookSignature('my-secret', String(nowTs), body, sig)).toBe(true);
  });

  it('returns false for an incorrect signature', () => {
    const nowTs = Math.floor(Date.now() / 1000);
    const body = '{"event":"payment.paid"}';
    expect(verifyWebhookSignature('my-secret', String(nowTs), body, 'deadbeef'.repeat(8))).toBe(false);
  });

  it('returns false when the timestamp is outside the replay window', () => {
    const oldTs = Math.floor(Date.now() / 1000) - 400; // 400s ago, default window is 300s
    const body = 'payload';
    const sig = signWebhook('secret', String(oldTs), body);
    expect(verifyWebhookSignature('secret', String(oldTs), body, sig, 300)).toBe(false);
  });

  it('returns false when the timestamp is non-finite (malformed)', () => {
    const body = 'payload';
    const sig = signWebhook('secret', 'not-a-number', body);
    expect(verifyWebhookSignature('secret', 'not-a-number', body, sig)).toBe(false);
  });

  it('returns false when signature lengths differ (wrong hex length)', () => {
    const nowTs = Math.floor(Date.now() / 1000);
    const body = 'payload';
    // Signature too short — timingSafeEqual would throw on length mismatch, function should return false
    expect(verifyWebhookSignature('secret', String(nowTs), body, 'abc')).toBe(false);
  });

  it('accepts a signature within a custom replay window', () => {
    const recentTs = Math.floor(Date.now() / 1000) - 50;
    const body = 'payload';
    const sig = signWebhook('secret', String(recentTs), body);
    expect(verifyWebhookSignature('secret', String(recentTs), body, sig, 120)).toBe(true);
  });
});
