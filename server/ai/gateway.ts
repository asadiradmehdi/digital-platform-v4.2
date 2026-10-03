import { AppError } from '../core/errors';
import type { AIProviderAdapter, AIRequest, AIResponse } from './contracts';
export type ModelRoute = { model: string; provider: string; adapter: AIProviderAdapter; enabled: boolean; priority: number };
export class AIGateway {
  constructor(private readonly routes: ModelRoute[]) {}
  async generate(input: AIRequest, signal?: AbortSignal): Promise<AIResponse> {
    const candidates = this.routes.filter(x=>x.enabled && x.model===input.model).sort((a,b)=>a.priority-b.priority);
    if (!candidates.length) throw new AppError('NOT_FOUND', `AI model ${input.model} is unavailable.`);
    let last: unknown;
    for (const route of candidates) { try { return await route.adapter.generate(input,signal); } catch (e) { last=e; } }
    throw new AppError('PROVIDER_ERROR','All configured AI providers failed.',undefined,last);
  }
}
