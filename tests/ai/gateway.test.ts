import { describe, it, expect, vi } from 'vitest';
import { AIGateway } from '../../server/ai/gateway';
import type { AIProviderAdapter, AIRequest, AIResponse } from '../../server/ai/contracts';

const baseRequest: AIRequest = {
  model: 'claude-sonnet-4-6',
  messages: [{ role: 'user', content: 'Hello' }],
};

const mockResponse: AIResponse = {
  text: 'Hi there!',
  inputUnits: 10n,
  outputUnits: 5n,
};

function makeAdapter(impl?: Partial<AIProviderAdapter>): AIProviderAdapter {
  return {
    generate: vi.fn().mockResolvedValue(mockResponse),
    streamGenerate: vi.fn(),
    ...impl,
  } as unknown as AIProviderAdapter;
}

describe('AIGateway', () => {
  it('throws NOT_FOUND when no routes match model', async () => {
    const gw = new AIGateway([]);
    await expect(gw.generate(baseRequest)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws NOT_FOUND when all routes are disabled', async () => {
    const gw = new AIGateway([{
      model: 'claude-sonnet-4-6', provider: 'anthropic',
      adapter: makeAdapter(), enabled: false, priority: 1,
    }]);
    await expect(gw.generate(baseRequest)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns response from enabled route', async () => {
    const adapter = makeAdapter();
    const gw = new AIGateway([{
      model: 'claude-sonnet-4-6', provider: 'anthropic',
      adapter, enabled: true, priority: 1,
    }]);
    const result = await gw.generate(baseRequest);
    expect(result).toMatchObject({ text: 'Hi there!' });
    expect(adapter.generate).toHaveBeenCalledWith(baseRequest, undefined);
  });

  it('falls back to next route when first fails', async () => {
    const failing = makeAdapter({ generate: vi.fn().mockRejectedValue(new Error('Timeout')) });
    const succeeding = makeAdapter();
    const gw = new AIGateway([
      { model: 'claude-sonnet-4-6', provider: 'provider-a', adapter: failing, enabled: true, priority: 1 },
      { model: 'claude-sonnet-4-6', provider: 'provider-b', adapter: succeeding, enabled: true, priority: 2 },
    ]);
    const result = await gw.generate(baseRequest);
    expect(result).toMatchObject({ text: 'Hi there!' });
    expect(failing.generate).toHaveBeenCalled();
    expect(succeeding.generate).toHaveBeenCalled();
  });

  it('sorts by priority (lower first) and uses lowest priority route first', async () => {
    const order: string[] = [];
    const adapterA = makeAdapter({ generate: vi.fn().mockImplementation(() => { order.push('A'); return Promise.resolve(mockResponse); }) });
    const adapterB = makeAdapter({ generate: vi.fn().mockImplementation(() => { order.push('B'); return Promise.resolve(mockResponse); }) });
    const gw = new AIGateway([
      { model: 'claude-sonnet-4-6', provider: 'b', adapter: adapterB, enabled: true, priority: 2 },
      { model: 'claude-sonnet-4-6', provider: 'a', adapter: adapterA, enabled: true, priority: 1 },
    ]);
    await gw.generate(baseRequest);
    expect(order[0]).toBe('A');
  });

  it('throws PROVIDER_ERROR when all routes fail', async () => {
    const adapter = makeAdapter({ generate: vi.fn().mockRejectedValue(new Error('fail')) });
    const gw = new AIGateway([
      { model: 'claude-sonnet-4-6', provider: 'a', adapter, enabled: true, priority: 1 },
    ]);
    await expect(gw.generate(baseRequest)).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });

  it('passes AbortSignal to adapter.generate', async () => {
    const adapter = makeAdapter();
    const gw = new AIGateway([{
      model: 'claude-sonnet-4-6', provider: 'anthropic', adapter, enabled: true, priority: 1,
    }]);
    const signal = new AbortController().signal;
    await gw.generate(baseRequest, signal);
    expect(adapter.generate).toHaveBeenCalledWith(baseRequest, signal);
  });
});
