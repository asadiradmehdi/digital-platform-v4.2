import { describe, it, expect, vi } from 'vitest';
import { registerChannelAdapter, createChannelAdapter } from '../../server/social/adapter-registry';

describe('social adapter-registry', () => {
  it('all 5 channel types are registered by default', () => {
    for (const type of ['instagram', 'telegram', 'tiktok', 'youtube', 'x'] as const) {
      expect(() => createChannelAdapter(type, {})).not.toThrow();
    }
  });

  it('returns an adapter with required channel methods', () => {
    const adapter = createChannelAdapter('instagram', {});
    expect(typeof adapter.publish).toBe('function');
    expect(typeof adapter.getCapabilities).toBe('function');
  });

  it('throws for unregistered channel type', () => {
    expect(() => createChannelAdapter('unknown' as never, {})).toThrow(
      'No adapter registered for channel type: unknown',
    );
  });

  it('registerChannelAdapter registers a new factory', () => {
    const factory = vi.fn().mockReturnValue({
      publish: vi.fn(),
      getCapabilities: vi.fn(),
      getAnalytics: vi.fn(),
    });
    registerChannelAdapter('instagram', factory);
    createChannelAdapter('instagram', { key: 'val' });
    expect(factory).toHaveBeenCalledWith({ key: 'val' });
  });
});
