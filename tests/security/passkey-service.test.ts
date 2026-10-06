import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  beginPasskeyRegistration,
  completePasskeyRegistration,
  beginPasskeyAuthentication,
  completePasskeyAuthentication,
  listPasskeys,
  revokePasskey,
} from '../../server/identity/passkey-service';
import type { PasskeyVerifier } from '../../server/identity/passkey-service';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));

import { query } from '../../server/core/db';

const qMock = vi.mocked(query);

const mockVerifier: PasskeyVerifier = {
  verifyAttestation: vi.fn(),
  verifyAssertion: vi.fn(),
};

beforeEach(() => { vi.resetAllMocks(); });

describe('beginPasskeyRegistration', () => {
  it('inserts a PASSKEY_REGISTER challenge and returns a raw token', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const token = await beginPasskeyRegistration('user-1');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
    const sql = qMock.mock.calls[0][0] as string;
    expect(sql).toContain('PASSKEY_REGISTER');
  });
});

describe('completePasskeyRegistration', () => {
  it('throws UNAUTHORIZED when challenge not found', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(
      completePasskeyRegistration('user-1', 'bad-token', {}, 'My Key', 'example.com', mockVerifier)
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('registers credential and returns id on success', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'ch-1' }], rowCount: 1 } as never); // find challenge
    vi.mocked(mockVerifier.verifyAttestation).mockResolvedValueOnce({
      credentialIdHash: 'cred-hash-1', publicKey: 'pub-key-1', signCount: 0,
    });
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // consume challenge
    qMock.mockResolvedValueOnce({ rows: [{ id: 'auth-1' }], rowCount: 1 } as never); // insert authenticator

    const id = await completePasskeyRegistration('user-1', 'valid-token', {}, 'My Key', 'example.com', mockVerifier);
    expect(id).toBe('auth-1');
  });

  it('throws CONFLICT when credential already registered (ON CONFLICT DO NOTHING)', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'ch-1' }], rowCount: 1 } as never);
    vi.mocked(mockVerifier.verifyAttestation).mockResolvedValueOnce({
      credentialIdHash: 'dup-hash', publicKey: 'pub', signCount: 0,
    });
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // consume
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // ON CONFLICT → no row

    await expect(
      completePasskeyRegistration('user-1', 'token', {}, null, 'example.com', mockVerifier)
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('beginPasskeyAuthentication', () => {
  it('inserts a PASSKEY_AUTHENTICATE challenge and returns a raw token', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const token = await beginPasskeyAuthentication('user-1');
    expect(typeof token).toBe('string');
    const sql = qMock.mock.calls[0][0] as string;
    expect(sql).toContain('PASSKEY_AUTHENTICATE');
  });
});

describe('completePasskeyAuthentication', () => {
  it('throws UNAUTHORIZED when challenge not found', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(
      completePasskeyAuthentication('user-1', 'bad', 'cred-hash', {}, 'example.com', mockVerifier)
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws NOT_FOUND when credential does not exist for user', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'ch-1' }], rowCount: 1 } as never); // find challenge
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // no authenticator
    await expect(
      completePasskeyAuthentication('user-1', 'token', 'no-cred', {}, 'example.com', mockVerifier)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws FORBIDDEN when new sign count does not advance (replay attack)', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'ch-1' }], rowCount: 1 } as never);
    qMock.mockResolvedValueOnce({ rows: [{ id: 'auth-1', publicKey: 'pub', signCount: '5' }], rowCount: 1 } as never);
    vi.mocked(mockVerifier.verifyAssertion).mockResolvedValueOnce({ credentialIdHash: 'c', newSignCount: 5 });
    await expect(
      completePasskeyAuthentication('user-1', 'token', 'cred-hash', {}, 'example.com', mockVerifier)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('succeeds, increments sign count, and returns authenticator id', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'ch-1' }], rowCount: 1 } as never);
    qMock.mockResolvedValueOnce({ rows: [{ id: 'auth-1', publicKey: 'pub', signCount: '5' }], rowCount: 1 } as never);
    vi.mocked(mockVerifier.verifyAssertion).mockResolvedValueOnce({ credentialIdHash: 'c', newSignCount: 6 });
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // update sign_count
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // consume challenge

    const authId = await completePasskeyAuthentication('user-1', 'token', 'cred-hash', {}, 'example.com', mockVerifier);
    expect(authId).toBe('auth-1');
  });
});

describe('listPasskeys', () => {
  it('returns active passkeys for user', async () => {
    qMock.mockResolvedValueOnce({
      rows: [{ id: 'pk-1', label: 'My Key', lastUsedAt: null, createdAt: '2026-01-01T00:00:00Z' }],
      rowCount: 1,
    } as never);
    const items = await listPasskeys('user-1');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('pk-1');
  });

  it('returns empty array when no passkeys', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    expect(await listPasskeys('user-1')).toEqual([]);
  });
});

describe('revokePasskey', () => {
  it('revokes passkey owned by user', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await expect(revokePasskey('pk-1', 'user-1')).resolves.toBeUndefined();
  });

  it('throws NOT_FOUND when passkey does not exist or not owned', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(revokePasskey('pk-bad', 'user-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
