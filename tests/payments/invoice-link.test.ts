import { afterEach, describe, expect, it, vi } from 'vitest';
import { signInvoiceViewToken, verifyInvoiceViewToken } from '../../server/payments/invoice-link';

const INV = '7d0c5f0e-1b2a-4c3d-8e9f-0a1b2c3d4e5f';
const OTHER = '11111111-2222-4333-8444-555555555555';
const WS = '9e8d7c6b-5a49-4382-8170-6f5e4d3c2b1a';
const NOW = 1_790_000_000_000;

afterEach(() => vi.unstubAllEnvs());

describe('invoice view links', () => {
  it('round-trips for the same invoice before expiry', () => {
    vi.stubEnv('SECRETS_MASTER_KEY', 'test-master-key');
    const t = signInvoiceViewToken(INV, WS, NOW)!;
    expect(t.startsWith(`${WS}.`)).toBe(true);
    expect(verifyInvoiceViewToken(INV, t, NOW + 60_000)).toEqual({ workspaceId: WS });
  });

  it('refuses another invoice, an expired token, a tampered workspace or signature', () => {
    vi.stubEnv('SECRETS_MASTER_KEY', 'test-master-key');
    const t = signInvoiceViewToken(INV, WS, NOW, 60)!;
    expect(verifyInvoiceViewToken(OTHER, t, NOW)).toBeNull();
    expect(verifyInvoiceViewToken(INV, t, NOW + 61_000)).toBeNull();
    const [, exp, sig] = t.split('.');
    expect(verifyInvoiceViewToken(INV, `${OTHER}.${exp}.${sig}`, NOW)).toBeNull();
    expect(verifyInvoiceViewToken(INV, `${WS}.${Number(exp) + 999}.${sig}`, NOW)).toBeNull();
    expect(verifyInvoiceViewToken(INV, `${WS}.${exp}.${sig.slice(0, -2)}xx`, NOW)).toBeNull();
    expect(verifyInvoiceViewToken(INV, 'garbage', NOW)).toBeNull();
    expect(verifyInvoiceViewToken(INV, undefined, NOW)).toBeNull();
  });

  it('a token signed with another secret is refused', () => {
    vi.stubEnv('SECRETS_MASTER_KEY', 'key-a');
    const t = signInvoiceViewToken(INV, WS, NOW)!;
    vi.stubEnv('SECRETS_MASTER_KEY', 'key-b');
    expect(verifyInvoiceViewToken(INV, t, NOW)).toBeNull();
  });

  it('issues and accepts nothing without SECRETS_MASTER_KEY', () => {
    vi.stubEnv('SECRETS_MASTER_KEY', '');
    expect(signInvoiceViewToken(INV, WS, NOW)).toBeNull();
    expect(verifyInvoiceViewToken(INV, `${WS}.${NOW}.x`, NOW)).toBeNull();
  });
});
