import type { ChannelAdapter, ChannelType, SocialContext } from '../contracts';

export class MockChannelAdapter implements ChannelAdapter {
  constructor(readonly channel: ChannelType) {}

  async getCapabilities(_context: SocialContext): Promise<Record<string, boolean>> {
    return { publish: true, analytics: true, schedule: true, reels: false };
  }

  async publish(input: { text?: string; mediaUrls?: string[] }, context: SocialContext): Promise<{ externalId: string }> {
    return { externalId: `mock-${context.channelId}-${context.idempotencyKey}` };
  }

  async analytics(_context: SocialContext): Promise<Record<string, number>> {
    return { followers: 1000, impressions: 5000, engagementRate: 42 };
  }
}
