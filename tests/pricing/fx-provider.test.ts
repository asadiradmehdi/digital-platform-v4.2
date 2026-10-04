import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpFxProvider } from '../../server/pricing/providers';

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => { globalThis.fetch = mockFetch; });
afterEach(() => { globalThis.fetch = originalFetch; vi.clearAllMocks(); });

const parser = (payload: unknown, base: string, quote: string) => ({
  numerator: BigInt((payload as { rate: number }).rate * 1000),
  denominator: 1000n,
  metadata: { base, quote },
});

describe('HttpFxProvider', () => {
  it('calls fetch with base and quote params', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rate: 1.25 }) });
    const provider = new HttpFxProvider('test', 'https://fx.example.com/rate', parser);
    await provider.getRate('USD', 'EUR');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('base=USD'),
      expect.any(Object),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('quote=EUR'),
      expect.any(Object),
    );
  });

  it('returns parsed numerator/denominator from parser', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rate: 2 }) });
    const provider = new HttpFxProvider('test', 'https://fx.example.com/rate', parser);
    const result = await provider.getRate('USD', 'IRR');
    expect(result.numerator).toBe(2000n);
    expect(result.denominator).toBe(1000n);
  });

  it('throws PROVIDER_ERROR on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    const provider = new HttpFxProvider('test', 'https://fx.example.com/rate', parser);
    await expect(provider.getRate('USD', 'EUR')).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });

  it('sends custom headers to fetch', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rate: 1 }) });
    const provider = new HttpFxProvider('test', 'https://fx.example.com/rate', parser, { 'x-api-key': 'my-key' });
    await provider.getRate('USD', 'GBP');
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)?.['x-api-key']).toBe('my-key');
  });

  it('passes AbortSignal to fetch', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rate: 1 }) });
    const provider = new HttpFxProvider('test', 'https://fx.example.com/rate', parser);
    const ctrl = new AbortController();
    await provider.getRate('USD', 'EUR', ctrl.signal);
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.signal).toBe(ctrl.signal);
  });

  it('exposes provider name', () => {
    const provider = new HttpFxProvider('my-provider', 'https://fx.example.com/rate', parser);
    expect(provider.name).toBe('my-provider');
  });
});
