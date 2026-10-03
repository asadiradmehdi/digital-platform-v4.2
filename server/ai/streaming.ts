import type { AIRequest } from './contracts';
import { streamAnthropic } from './providers/anthropic';
import { streamOpenAI } from './providers/openai';

function providerForModel(modelKey: string): string {
  if (modelKey.startsWith('claude-')) return 'anthropic';
  if (modelKey.startsWith('gpt-') || modelKey.startsWith('o1') || modelKey.startsWith('o3')) return 'openai';
  return 'unknown';
}

export function createStreamingResponse(input: AIRequest, signal?: AbortSignal): ReadableStream<Uint8Array> {
  const provider = providerForModel(input.model);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let generator: AsyncGenerator<string>;
      try {
        if (provider === 'anthropic') {
          generator = streamAnthropic(input, signal);
        } else if (provider === 'openai') {
          generator = streamOpenAI(input, signal);
        } else {
          throw new Error(`Streaming not supported for model: ${input.model}`);
        }

        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }
    },
  });
}
