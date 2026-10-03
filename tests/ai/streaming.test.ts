import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the provider streaming modules before importing the module under test.
vi.mock('../../server/ai/providers/anthropic', () => ({
  anthropicAdapter: {},
  streamAnthropic: vi.fn(),
}));
vi.mock('../../server/ai/providers/openai', () => ({
  openaiAdapter: {},
  streamOpenAI: vi.fn(),
}));

import { streamAnthropic } from '../../server/ai/providers/anthropic';
import { streamOpenAI } from '../../server/ai/providers/openai';
import { createStreamingResponse } from '../../server/ai/streaming';
import type { AIRequest } from '../../server/ai/contracts';

const mockStreamAnthropic = vi.mocked(streamAnthropic);
const mockStreamOpenAI = vi.mocked(streamOpenAI);

function makeRequest(model: string): AIRequest {
  return {
    model,
    messages: [{ role: 'user', content: 'hello' }],
  };
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

async function* makeAsyncGen(...chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

beforeEach(() => vi.clearAllMocks());

describe('createStreamingResponse — provider routing', () => {
  it('routes claude- models to anthropic provider', async () => {
    mockStreamAnthropic.mockReturnValueOnce(makeAsyncGen('hello'));
    const stream = createStreamingResponse(makeRequest('claude-sonnet-4-6'));
    await readStream(stream);
    expect(mockStreamAnthropic).toHaveBeenCalledOnce();
    expect(mockStreamOpenAI).not.toHaveBeenCalled();
  });

  it('routes gpt- models to openai provider', async () => {
    mockStreamOpenAI.mockReturnValueOnce(makeAsyncGen('world'));
    const stream = createStreamingResponse(makeRequest('gpt-4o'));
    await readStream(stream);
    expect(mockStreamOpenAI).toHaveBeenCalledOnce();
    expect(mockStreamAnthropic).not.toHaveBeenCalled();
  });

  it('routes o1 models to openai provider', async () => {
    mockStreamOpenAI.mockReturnValueOnce(makeAsyncGen('response'));
    const stream = createStreamingResponse(makeRequest('o1-preview'));
    await readStream(stream);
    expect(mockStreamOpenAI).toHaveBeenCalledOnce();
  });

  it('routes o3 models to openai provider', async () => {
    mockStreamOpenAI.mockReturnValueOnce(makeAsyncGen('response'));
    const stream = createStreamingResponse(makeRequest('o3-mini'));
    await readStream(stream);
    expect(mockStreamOpenAI).toHaveBeenCalledOnce();
  });

  it('emits error SSE event for unknown model', async () => {
    const stream = createStreamingResponse(makeRequest('unknown-model-xyz'));
    const output = await readStream(stream);
    expect(output).toContain('data:');
    const lines = output.split('\n').filter(l => l.startsWith('data:'));
    const errorLine = lines.find(l => l.includes('error'));
    expect(errorLine).toBeTruthy();
    const parsed = JSON.parse(errorLine!.replace(/^data:\s*/, '')) as { error?: string };
    expect(parsed.error).toContain('unknown-model-xyz');
  });
});

describe('createStreamingResponse — SSE format', () => {
  it('emits chunks as data: {text} SSE lines', async () => {
    mockStreamAnthropic.mockReturnValueOnce(makeAsyncGen('chunk1', 'chunk2'));
    const stream = createStreamingResponse(makeRequest('claude-haiku-4-5'));
    const output = await readStream(stream);
    expect(output).toContain('data: {"text":"chunk1"}\n\n');
    expect(output).toContain('data: {"text":"chunk2"}\n\n');
  });

  it('emits [DONE] sentinel at end of stream', async () => {
    mockStreamAnthropic.mockReturnValueOnce(makeAsyncGen('hello'));
    const stream = createStreamingResponse(makeRequest('claude-sonnet-4-6'));
    const output = await readStream(stream);
    expect(output).toContain('data: [DONE]\n\n');
  });

  it('emits error SSE when provider throws', async () => {
    mockStreamAnthropic.mockReturnValueOnce(
      (async function* () { throw new Error('provider error'); })()
    );
    const stream = createStreamingResponse(makeRequest('claude-sonnet-4-6'));
    const output = await readStream(stream);
    expect(output).toContain('"error"');
    expect(output).toContain('provider error');
  });

  it('passes the AbortSignal to the provider', async () => {
    mockStreamAnthropic.mockReturnValueOnce(makeAsyncGen('ok'));
    const controller = new AbortController();
    createStreamingResponse(makeRequest('claude-opus-4-7'), controller.signal);
    // Give the async start() a tick to fire
    await new Promise(r => setTimeout(r, 0));
    expect(mockStreamAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-7' }),
      controller.signal
    );
  });
});
