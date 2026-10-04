import { describe, it, expect } from 'vitest';
import {
  registerAdapterFactory,
  createAdapter,
  hasAdapter,
} from '../../server/providers/adapter-registry';

describe('adapter-registry', () => {
  it('mock adapter is registered by default', () => {
    expect(hasAdapter('mock')).toBe(true);
  });

  it('returns false for unknown provider type', () => {
    expect(hasAdapter('nonexistent-provider-xyz')).toBe(false);
  });

  it('creates mock adapter without error', () => {
    const adapter = createAdapter('mock', {});
    expect(adapter).toBeDefined();
    expect(typeof adapter.submit).toBe('function');
    expect(typeof adapter.status).toBe('function');
  });

  it('throws for unregistered provider type', () => {
    expect(() => createAdapter('unknown-xyz', {})).toThrow(
      'No adapter registered for provider type: unknown-xyz',
    );
  });

  it('registerAdapterFactory adds a new factory', () => {
    registerAdapterFactory('test-provider-x', () => ({} as never));
    expect(hasAdapter('test-provider-x')).toBe(true);
  });

  it('createAdapter calls registered factory with credentials', () => {
    const creds = { apiKey: 'test-key' };
    let receivedCreds: Record<string, string> | null = null;
    registerAdapterFactory('test-cred-check', (c) => {
      receivedCreds = c;
      return {} as never;
    });
    createAdapter('test-cred-check', creds);
    expect(receivedCreds).toEqual(creds);
  });

  it('registerAdapterFactory overwrites existing factory', () => {
    let callCount = 0;
    registerAdapterFactory('overwrite-test', () => { callCount++; return {} as never; });
    registerAdapterFactory('overwrite-test', () => { callCount += 10; return {} as never; });
    createAdapter('overwrite-test', {});
    expect(callCount).toBe(10);
  });
});
