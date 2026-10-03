import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/core/secret-box', () => ({
  decryptSecret: vi.fn((s: string) => (s ? `decrypted:${s}` : '')),
}));
vi.mock('../../server/social/adapter-registry', () => ({
  createChannelAdapter: vi.fn(),
}));

import { query } from '../../server/core/db';
import { createChannelAdapter } from '../../server/social/adapter-registry';
import { publishToChannel, schedulePost } from '../../server/social/publishing';
import { ingestChannelAnalytics, getAnalyticsSummary } from '../../server/social/analytics';

const mockQuery = vi.mocked(query);
const mockCreateAdapter = vi.mocked(createChannelAdapter);
beforeEach(() => vi.clearAllMocks());

// ─── publishToChannel ────────────────────────────────────────────────────────

describe('publishToChannel', () => {
  it('throws NOT_FOUND when channel is not found or not connected', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      publishToChannel({ channelId: 'ch-1', workspaceId: 'ws-1', text: 'Hello', idempotencyKey: 'k1' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws UNAVAILABLE when adapter does not support publishing', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ channel_type: 'instagram', access_token_ciphertext: null }], rowCount: 1,
    } as never);
    mockCreateAdapter.mockReturnValueOnce({ channel: 'instagram', getCapabilities: vi.fn() } as never);

    await expect(
      publishToChannel({ channelId: 'ch-1', workspaceId: 'ws-1', text: 'Hello', idempotencyKey: 'k2' })
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('calls adapter.publish and returns externalId', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ channel_type: 'telegram', access_token_ciphertext: 'enc:token-123' }], rowCount: 1,
    } as never);
    const mockPublish = vi.fn().mockResolvedValueOnce({ externalId: 'ext-post-1' });
    mockCreateAdapter.mockReturnValueOnce({ channel: 'telegram', getCapabilities: vi.fn(), publish: mockPublish } as never);

    const result = await publishToChannel({
      channelId: 'ch-2', workspaceId: 'ws-1', text: 'Test post', idempotencyKey: 'k3',
    });

    expect(result.externalId).toBe('ext-post-1');
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Test post' }),
      expect.objectContaining({ channelId: 'ch-2', workspaceId: 'ws-1', idempotencyKey: 'k3' })
    );
  });
});

// ─── schedulePost ────────────────────────────────────────────────────────────

describe('schedulePost', () => {
  it('inserts a job and returns the job id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'job-1' }], rowCount: 1 } as never);

    const jobId = await schedulePost({
      channelId: 'ch-1', workspaceId: 'ws-1', text: 'Scheduled post',
      idempotencyKey: 'k4', scheduledAt: new Date('2026-10-10T10:00:00Z'),
    });

    expect(jobId).toBe('job-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT(dedupe_key) DO NOTHING"),
      expect.arrayContaining([expect.any(Object), '2026-10-10T10:00:00.000Z'])
    );
  });

  it('returns empty string when job conflicts with dedupe key', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const jobId = await schedulePost({
      channelId: 'ch-1', workspaceId: 'ws-1', idempotencyKey: 'k5',
      scheduledAt: new Date(),
    });

    expect(jobId).toBe('');
  });
});

// ─── ingestChannelAnalytics ───────────────────────────────────────────────────

describe('ingestChannelAnalytics', () => {
  it('throws NOT_FOUND when channel is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      ingestChannelAnalytics('ch-1', 'ws-1')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws UNAVAILABLE when adapter does not support analytics', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ channel_type: 'youtube', access_token_ciphertext: null }], rowCount: 1,
    } as never);
    mockCreateAdapter.mockReturnValueOnce({ channel: 'youtube', getCapabilities: vi.fn() } as never);

    await expect(ingestChannelAnalytics('ch-1', 'ws-1')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('calls adapter.analytics, stores snapshot, and returns metrics', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ channel_type: 'instagram', access_token_ciphertext: 'enc:tok' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // INSERT snapshot
    const mockAnalytics = vi.fn().mockResolvedValueOnce({ followers: 100, impressions: 5000 });
    mockCreateAdapter.mockReturnValueOnce({ channel: 'instagram', getCapabilities: vi.fn(), analytics: mockAnalytics } as never);

    const data = await ingestChannelAnalytics('ch-2', 'ws-1');

    expect(data.followers).toBe(100);
    expect(data.impressions).toBe(5000);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('social_analytics_snapshots'),
      expect.arrayContaining(['ch-2'])
    );
  });
});

// ─── getAnalyticsSummary ──────────────────────────────────────────────────────

describe('getAnalyticsSummary', () => {
  it('returns empty array when no snapshots exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await getAnalyticsSummary('ch-1', 'ws-1');
    expect(result).toHaveLength(0);
  });

  it('returns mapped snapshots with capturedAt and metrics', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { captured_at: '2026-10-01T00:00:00Z', metrics: { followers: 200 } },
        { captured_at: '2026-10-02T00:00:00Z', metrics: { followers: 250 } },
      ],
      rowCount: 2,
    } as never);

    const result = await getAnalyticsSummary('ch-1', 'ws-1', 10);
    expect(result).toHaveLength(2);
    expect(result[0].capturedAt).toBe('2026-10-01T00:00:00Z');
    expect(result[1].metrics).toEqual({ followers: 250 });
  });
});
