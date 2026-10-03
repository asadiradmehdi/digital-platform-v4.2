import type { AIProviderAdapter, AIRequest, AIResponse } from '../contracts';

const BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

function apiKey(): string {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) throw new Error('ANTHROPIC_API_KEY is not configured.');
  return k;
}

export const anthropicAdapter: AIProviderAdapter = {
  provider: 'anthropic',

  async generate(input: AIRequest, signal?: AbortSignal): Promise<AIResponse> {
    const systemMessages = input.messages.filter(m => m.role === 'system');
    const nonSystemMessages = input.messages.filter(m => m.role !== 'system');
    const body: Record<string, unknown> = {
      model: input.model,
      max_tokens: input.maxOutputTokens ?? 4096,
      messages: nonSystemMessages.map(m => ({ role: m.role, content: m.content })),
    };
    if (systemMessages.length) body.system = systemMessages.map(m => m.content).join('\n');
    if (input.temperature !== undefined) body.temperature = input.temperature;

    const res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey(),
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data = await res.json() as {
      id: string;
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return {
      text,
      inputUnits: BigInt(data.usage.input_tokens),
      outputUnits: BigInt(data.usage.output_tokens),
      providerRequestId: data.id,
      raw: data,
    };
  },
};

export async function* streamAnthropic(input: AIRequest, signal?: AbortSignal): AsyncGenerator<string> {
  const systemMessages = input.messages.filter(m => m.role === 'system');
  const nonSystemMessages = input.messages.filter(m => m.role !== 'system');
  const body: Record<string, unknown> = {
    model: input.model,
    max_tokens: input.maxOutputTokens ?? 4096,
    stream: true,
    messages: nonSystemMessages.map(m => ({ role: m.role, content: m.content })),
  };
  if (systemMessages.length) body.system = systemMessages.map(m => m.content).join('\n');
  if (input.temperature !== undefined) body.temperature = input.temperature;

  const res = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey(),
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic stream error ${res.status}: ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') return;
      try {
        const event = JSON.parse(raw) as { type: string; delta?: { type: string; text?: string } };
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
          yield event.delta.text;
        }
      } catch {
        // skip malformed SSE line
      }
    }
  }
}
