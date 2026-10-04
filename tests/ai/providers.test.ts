import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = mockFetch;
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  process.env.OPENAI_API_KEY = 'test-openai-key';
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

import { anthropicAdapter } from '../../server/ai/providers/anthropic';
import { openaiAdapter } from '../../server/ai/providers/openai';

const baseRequest = {
  model: 'claude-sonnet-4-6',
  messages: [{ role: 'user' as const, content: 'Hello' }],
};

describe('anthropicAdapter', () => {
  it('has provider=anthropic', () => {
    expect(anthropicAdapter.provider).toBe('anthropic');
  });

  it('calls Anthropic messages endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'msg-1',
        content: [{ type: 'text', text: 'Hi!' }],
        usage: { input_tokens: 5, output_tokens: 3 },
      }),
    });
    await anthropicAdapter.generate(baseRequest);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.anthropic.com'),
      expect.any(Object),
    );
  });

  it('returns text, inputUnits, outputUnits from response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'msg-1',
        content: [{ type: 'text', text: 'Hello world' }],
        usage: { input_tokens: 10, output_tokens: 8 },
      }),
    });
    const result = await anthropicAdapter.generate(baseRequest);
    expect(result.text).toBe('Hello world');
    expect(result.inputUnits).toBe(10n);
    expect(result.outputUnits).toBe(8n);
    expect(result.providerRequestId).toBe('msg-1');
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });
    await expect(anthropicAdapter.generate(baseRequest)).rejects.toThrow(/Anthropic API error 401/);
  });

  it('throws when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(anthropicAdapter.generate(baseRequest)).rejects.toThrow('ANTHROPIC_API_KEY');
  });

  it('separates system messages from user messages', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'm', content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }),
    });
    await anthropicAdapter.generate({
      model: 'claude-sonnet-4-6',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
      ],
    });
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.system).toBe('You are helpful.');
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
  });
});

describe('openaiAdapter', () => {
  const openaiRequest = { ...baseRequest, model: 'gpt-4o' };

  it('has provider=openai', () => {
    expect(openaiAdapter.provider).toBe('openai');
  });

  it('calls OpenAI chat completions endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-1',
        choices: [{ message: { content: 'Hi!' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3 },
      }),
    });
    await openaiAdapter.generate(openaiRequest);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('openai.com'),
      expect.any(Object),
    );
  });

  it('returns text, inputUnits, outputUnits', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-2',
        choices: [{ message: { content: 'OpenAI response' } }],
        usage: { prompt_tokens: 12, completion_tokens: 7 },
      }),
    });
    const result = await openaiAdapter.generate(openaiRequest);
    expect(result.text).toBe('OpenAI response');
    expect(result.inputUnits).toBe(12n);
    expect(result.outputUnits).toBe(7n);
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'Rate limited' });
    await expect(openaiAdapter.generate(openaiRequest)).rejects.toThrow(/429/);
  });

  it('throws when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(openaiAdapter.generate(openaiRequest)).rejects.toThrow('OPENAI_API_KEY');
  });
});
