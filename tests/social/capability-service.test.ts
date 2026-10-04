import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

vi.mock('../../server/core/secret-box', () => ({
  decryptSecret: vi.fn((c: string) => `decrypted:${c}`),
}));

vi.mock('../../server/social/adapter-registry', () => ({
  createChannelAdapter: vi.fn(),
}));

import { query } from '../../server/core/db';
import { createChannelAdapter } from '../../server/social/adapter-registry';
import { discoverChannelCapabilities, getStoredCapabilities } from '../../server/social/capability-service';

const mockQuery = vi.mocked(query);
const mockCreateAdapter = vi.mocked(createChannelAdapter);

beforeEach(() => vi.clearAllMocks());

const mockAdapter = {
  getCapabilities: vi.fn().mockResolvedValue({ publish: true, schedule: false }),
  publish: vi.fn(),
  getAnalytics: vi.fn(),
};

describe('discoverChannelCapabilities', () => {
  it('returns empty object when channel is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await discoverChannelCapabilities('ch-1', 'ws-1');
    expect(result).toEqual({});
    expect(mockCreateAdapter).not.toHaveBeenCalled();
  });

  it('returns capabilities from adapter and upserts each into DB', async () => {
    // channel lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ channel_type: 'instagram' }], rowCount: 1 } as never);
    // channel_connections lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ access_token_ciphertext: 'ct-access', refresh_token_ciphertext: null }], rowCount: 1 } as never);
    // two upserts for publish and schedule
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

    mockCreateAdapter.mockReturnValueOnce(mockAdapter as never);

    const result = await discoverChannelCapabilities('ch-1', 'ws-1');
    expect(result).toEqual({ publish: true, schedule: false });
    expect(mockCreateAdapter).toHaveBeenCalledWith('instagram', expect.objectContaining({ access_token: 'decrypted:ct-access' }));

    const upsertCalls = mockQuery.mock.calls.filter((call) =>
      (call[0] as string).includes('INSERT INTO channel_capabilities'),
    );
    expect(upsertCalls).toHaveLength(2);
  });

  it('queries channel with workspace scoping', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await discoverChannelCapabilities('ch-99', 'ws-99');
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain('ch-99');
    expect(params).toContain('ws-99');
  });

  it('uses ON CONFLICT DO UPDATE for capability upsert', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ channel_type: 'twitter' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    mockCreateAdapter.mockReturnValueOnce({ ...mockAdapter, getCapabilities: vi.fn().mockResolvedValue({ reply: true }) } as never);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

    await discoverChannelCapabilities('ch-1', 'ws-1');
    const upsertCall = mockQuery.mock.calls.find((call) =>
      (call[0] as string).includes('ON CONFLICT'),
    );
    expect(upsertCall).toBeDefined();
  });
});

describe('getStoredCapabilities', () => {
  it('returns capabilities map from DB rows', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { capability_key: 'publish', supported: true },
        { capability_key: 'schedule', supported: false },
      ],
      rowCount: 2,
    } as never);

    const result = await getStoredCapabilities('instagram');
    expect(result).toEqual({ publish: true, schedule: false });
  });

  it('returns empty object when no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await getStoredCapabilities('tiktok');
    expect(result).toEqual({});
  });

  it('queries by channel_type', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await getStoredCapabilities('youtube');
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain('youtube');
  });
});
