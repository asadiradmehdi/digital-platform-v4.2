import type { AIProviderAdapter, AIRequest, AIResponse } from '../contracts';

const BASE_URL = 'https://api.openai.com/v1';

function apiKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error('OPENAI_API_KEY is not configured.');
  return k;
}

export const openaiAdapter: AIProviderAdapter = {
  provider: 'openai',

  async generate(input: AIRequest, signal?: AbortSignal): Promise<AIResponse> {
    const body = {
      model: input.model,
      messages: input.messages.map(m => ({ role: m.role, content: m.content })),
      ...(input.temperature !== undefined && { temperature: input.temperature }),
      ...(input.maxOutputTokens && { max_tokens: input.maxOutputTokens }),
    };

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`OpenAI API error ${res.status}: ${err}`);
    }

    const data = await res.json() as {
      id: string;
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    const text = data.choices[0]?.message.content ?? '';
    return {
      text,
      inputUnits: BigInt(data.usage.prompt_tokens),
      outputUnits: BigInt(data.usage.completion_tokens),
      providerRequestId: data.id,
      raw: data,
    };
  },
};

export async function* streamOpenAI(input: AIRequest, signal?: AbortSignal): AsyncGenerator<string> {
  const body = {
    model: input.model,
    stream: true,
    messages: input.messages.map(m => ({ role: m.role, content: m.content })),
    ...(input.temperature !== undefined && { temperature: input.temperature }),
    ...(input.maxOutputTokens && { max_tokens: input.maxOutputTokens }),
  };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI stream error ${res.status}: ${err}`);
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
        const event = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = event.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // skip malformed SSE line
      }
    }
  }
}
