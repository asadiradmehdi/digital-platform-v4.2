import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

vi.mock('../../server/core/secret-box', () => ({
  encryptSecret: vi.fn((plain: string) => `enc:${plain}`),
  decryptSecret: vi.fn((cipher: string) => cipher.replace('enc:', '')),
}));

import { query } from '../../server/core/db';
import { encryptSecret, decryptSecret } from '../../server/core/secret-box';
import {
  getProviderCredentials,
  upsertProviderCredential,
  revokeProviderCredential,
} from '../../server/providers/credential-vault';

const mockQuery = vi.mocked(query);
const mockEncrypt = vi.mocked(encryptSecret);
const mockDecrypt = vi.mocked(decryptSecret);

beforeEach(() => vi.clearAllMocks());

describe('getProviderCredentials', () => {
  it('returns decrypted credentials keyed by credential_name', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { credential_name: 'api_key', secret_ciphertext: 'enc:secret-123' },
        { credential_name: 'webhook_secret', secret_ciphertext: 'enc:webhook-abc' },
      ],
      rowCount: 2,
    } as never);

    const creds = await getProviderCredentials('provider-1');
    expect(creds).toEqual({ api_key: 'secret-123', webhook_secret: 'webhook-abc' });
    expect(mockDecrypt).toHaveBeenCalledTimes(2);
  });

  it('returns empty object when provider has no credentials', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const creds = await getProviderCredentials('provider-none');
    expect(creds).toEqual({});
  });

  it('queries only active=true credentials', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await getProviderCredentials('p-1');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('active=true');
    expect(sql).toContain('provider_id=$1');
  });

  it('calls decryptSecret for each row', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { credential_name: 'k1', secret_ciphertext: 'c1' },
        { credential_name: 'k2', secret_ciphertext: 'c2' },
        { credential_name: 'k3', secret_ciphertext: 'c3' },
      ],
      rowCount: 3,
    } as never);

    await getProviderCredentials('p-1');
    expect(mockDecrypt).toHaveBeenCalledTimes(3);
    expect(mockDecrypt).toHaveBeenCalledWith('c1');
    expect(mockDecrypt).toHaveBeenCalledWith('c2');
    expect(mockDecrypt).toHaveBeenCalledWith('c3');
  });
});

describe('upsertProviderCredential', () => {
  it('encrypts the plain secret before inserting', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await upsertProviderCredential('p-1', 'api_key', 'my-secret');
    expect(mockEncrypt).toHaveBeenCalledWith('my-secret');
  });

  it('uses INSERT ... ON CONFLICT DO UPDATE for idempotency', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await upsertProviderCredential('p-1', 'api_key', 'secret');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT(provider_id, credential_name) DO UPDATE');
    expect(sql).toContain('active=true');
  });

  it('passes providerId, name, and ciphertext as params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    mockEncrypt.mockReturnValueOnce('enc:val');
    await upsertProviderCredential('p-1', 'token', 'val');
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe('p-1');
    expect(params[1]).toBe('token');
    expect(params[2]).toBe('enc:val');
  });

  it('re-activates a previously revoked credential', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await upsertProviderCredential('p-1', 'key', 'new-secret');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('active=true');
  });
});

describe('revokeProviderCredential', () => {
  it('sets active=false for the named credential', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await revokeProviderCredential('p-1', 'api_key');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('SET active=false');
    expect(params[0]).toBe('p-1');
    expect(params[1]).toBe('api_key');
  });

  it('does not delete the row (revoke is reversible)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await revokeProviderCredential('p-2', 'secret');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('DELETE');
    expect(sql).toContain('UPDATE');
  });

  it('resolves without throwing when credential does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(revokeProviderCredential('p-none', 'nonexistent')).resolves.not.toThrow();
  });
});
