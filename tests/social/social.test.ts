import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/core/secret-box', () => ({
  decryptSecret: vi.fn((s: string) => s.replace('enc:', '')),
}));

import { MockChannelAdapter } from '../../server/social/adapters/mock';
import { createChannelAdapter, registerChannelAdapter } from '../../server/social/adapter-registry';

beforeEach(() => vi.clearAllMocks());

describe('MockChannelAdapter', () => {
  it('getCapabilities returns capabilities map', async () => {
    const adapter = new MockChannelAdapter('instagram');
    const caps = await adapter.getCapabilities({ workspaceId: 'ws-1', channelId: 'ch-1', correlationId: 'c', idempotencyKey: 'k' });
    expect(caps.publish).toBe(true);
    expect(caps.analytics).toBe(true);
  });

  it('publish returns externalId containing channelId', async () => {
    const adapter = new MockChannelAdapter('telegram');
    const result = await adapter.publish({ text: 'Hello' }, { workspaceId: 'ws-1', channelId: 'ch-2', correlationId: 'c', idempotencyKey: 'idem-1' });
    expect(result.externalId).toContain('ch-2');
  });

  it('analytics returns numeric metrics', async () => {
    const adapter = new MockChannelAdapter('tiktok');
    const data = await adapter.analytics({ workspaceId: 'ws-1', channelId: 'ch-3', correlationId: 'c', idempotencyKey: 'k' });
    expect(typeof data.followers).toBe('number');
    expect(typeof data.impressions).toBe('number');
  });
});

describe('adapter-registry', () => {
  it('createChannelAdapter returns MockChannelAdapter for all known types', () => {
    for (const type of ['instagram', 'telegram', 'tiktok', 'youtube', 'x'] as const) {
      const adapter = createChannelAdapter(type, {});
      expect(adapter.channel).toBe(type);
    }
  });

  it('createChannelAdapter throws for unknown channel type', () => {
    expect(() => createChannelAdapter('unknown' as never, {})).toThrow('No adapter registered');
  });

  it('registerChannelAdapter can override with a custom adapter', () => {
    const custom = new MockChannelAdapter('youtube');
    registerChannelAdapter('youtube', () => custom);
    const adapter = createChannelAdapter('youtube', {});
    expect(adapter).toBe(custom);
  });
});
