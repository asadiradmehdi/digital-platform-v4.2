import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/core/secret-box', () => ({
  encryptSecret: vi.fn((s: string) => `enc:${s}`),
  decryptSecret: vi.fn((s: string) => s.replace('enc:', '')),
}));

import { query } from '../../server/core/db';
import { getProviderCredentials, upsertProviderCredential, revokeProviderCredential } from '../../server/providers/credential-vault';
import { createAdapter, hasAdapter, registerAdapterFactory } from '../../server/providers/adapter-registry';
import { MockProviderAdapter } from '../../server/providers/adapters/mock';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('credential-vault', () => {
  it('getProviderCredentials decrypts all active credentials', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [
      { credential_name: 'api_key', secret_ciphertext: 'enc:secret-value' },
      { credential_name: 'secret', secret_ciphertext: 'enc:another-secret' },
    ], rowCount: 2 } as never);
    const creds = await getProviderCredentials('prov-1');
    expect(creds).toEqual({ api_key: 'secret-value', secret: 'another-secret' });
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE provider_id=$1 AND active=true'), ['prov-1']);
  });

  it('getProviderCredentials returns empty object when no credentials', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const creds = await getProviderCredentials('prov-2');
    expect(creds).toEqual({});
  });

  it('upsertProviderCredential encrypts and upserts', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await upsertProviderCredential('prov-1', 'api_key', 'my-secret');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(provider_id, credential_name) DO UPDATE'),
      ['prov-1', 'api_key', 'enc:my-secret']
    );
  });

  it('revokeProviderCredential sets active=false', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await revokeProviderCredential('prov-1', 'api_key');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SET active=false'),
      ['prov-1', 'api_key']
    );
  });
});

describe('adapter-registry', () => {
  it('hasAdapter returns true for mock', () => {
    expect(hasAdapter('mock')).toBe(true);
  });

  it('hasAdapter returns false for unknown type', () => {
    expect(hasAdapter('nonexistent-provider-xyz')).toBe(false);
  });

  it('createAdapter returns MockProviderAdapter for mock type', () => {
    const adapter = createAdapter('mock', {});
    expect(adapter).toBeInstanceOf(MockProviderAdapter);
    expect(adapter.providerType).toBe('mock');
  });

  it('createAdapter throws for unknown type', () => {
    expect(() => createAdapter('nonexistent-xyz', {})).toThrow('No adapter registered');
  });

  it('registerAdapterFactory adds a new factory', () => {
    registerAdapterFactory('test-custom', (_creds) => new MockProviderAdapter({ submitStatus: 'COMPLETED' }));
    const adapter = createAdapter('test-custom', {});
    expect(adapter.providerType).toBe('mock');
  });
});

describe('MockProviderAdapter', () => {
  it('submit returns externalOrderId with PROCESSING status by default', async () => {
    const adapter = new MockProviderAdapter();
    const result = await adapter.submit(
      { externalServiceId: 'svc-1', quantity: 100n, parameters: {} },
      { correlationId: 'corr-1', idempotencyKey: 'idem-1' }
    );
    expect(result.externalOrderId).toContain('idem-1');
    expect(result.status).toBe('PROCESSING');
  });

  it('submit throws when failOnSubmit is true', async () => {
    const adapter = new MockProviderAdapter({ failOnSubmit: true });
    await expect(
      adapter.submit({ externalServiceId: 'svc-1', quantity: 1n, parameters: {} }, { correlationId: 'c', idempotencyKey: 'k' })
    ).rejects.toThrow('simulated submit failure');
  });

  it('status always returns COMPLETED', async () => {
    const adapter = new MockProviderAdapter();
    const result = await adapter.status('ext-order-1', { correlationId: 'c', idempotencyKey: 'k' });
    expect(result.status).toBe('COMPLETED');
  });

  it('balance returns configured amount', async () => {
    const adapter = new MockProviderAdapter({ balance: { amountMinor: 50_000n, currency: 'EUR' } });
    const bal = await adapter.balance!();
    expect(bal.amountMinor).toBe(50_000n);
    expect(bal.currency).toBe('EUR');
  });
});
