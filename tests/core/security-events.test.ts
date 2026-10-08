/** Regression: the INSERT had 9 placeholders for 8 values, so every sign-up failed with 500. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
import { query } from '../../server/core/db';
import { recordSecurityEvent } from '../../server/core/security-events';

beforeEach(() => vi.clearAllMocks());

describe('recordSecurityEvent', () => {
  it('binds exactly as many values as the statement has placeholders', async () => {
    await recordSecurityEvent({ eventType: 'ACCOUNT_REGISTERED', severity: 'INFO', sourceIp: '203.0.113.7', metadata: { a: 1 } });
    const [sql, params] = vi.mocked(query).mock.calls[0] as [string, unknown[]];
    const placeholders = new Set(sql.match(/\$\d+/g));
    expect(placeholders.size).toBe(params.length);
    expect(params[5]).toBe('203.0.113.7');
  });
  it('drops a source fingerprint that is not an IP address instead of failing the insert', async () => {
    await recordSecurityEvent({ eventType: 'X', severity: 'INFO', sourceIp: 'unknown' });
    const params = vi.mocked(query).mock.calls[0][1] as unknown[];
    expect(params[5]).toBeNull();
  });
});
