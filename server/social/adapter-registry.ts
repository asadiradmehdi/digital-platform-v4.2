import type { ChannelAdapter, ChannelType } from './contracts';
import { MockChannelAdapter } from './adapters/mock';

export type ChannelAdapterFactory = (credentials: Record<string, string>) => ChannelAdapter;

const registry = new Map<ChannelType, ChannelAdapterFactory>();

const ALL_CHANNEL_TYPES: ChannelType[] = ['instagram', 'telegram', 'tiktok', 'youtube', 'x'];
for (const type of ALL_CHANNEL_TYPES) {
  registry.set(type, (_creds) => new MockChannelAdapter(type));
}

export function registerChannelAdapter(type: ChannelType, factory: ChannelAdapterFactory): void {
  registry.set(type, factory);
}

export function createChannelAdapter(type: ChannelType, credentials: Record<string, string>): ChannelAdapter {
  const factory = registry.get(type);
  if (!factory) throw new Error(`No adapter registered for channel type: ${type}`);
  return factory(credentials);
}
