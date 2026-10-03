import type { ProviderAdapter } from './contracts';
import { MockProviderAdapter } from './adapters/mock';

export type AdapterFactory = (credentials: Record<string, string>) => ProviderAdapter;

const registry = new Map<string, AdapterFactory>();

registry.set('mock', (_creds) => new MockProviderAdapter());

export function registerAdapterFactory(providerType: string, factory: AdapterFactory): void {
  registry.set(providerType, factory);
}

export function createAdapter(providerType: string, credentials: Record<string, string>): ProviderAdapter {
  const factory = registry.get(providerType);
  if (!factory) throw new Error(`No adapter registered for provider type: ${providerType}`);
  return factory(credentials);
}

export function hasAdapter(providerType: string): boolean {
  return registry.has(providerType);
}
