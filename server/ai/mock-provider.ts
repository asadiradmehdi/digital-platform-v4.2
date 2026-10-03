import type { AIProviderAdapter, AIRequest, AIResponse } from './contracts';
export const mockAIProvider: AIProviderAdapter = { provider:'mock', async generate(input: AIRequest): Promise<AIResponse> { const last=input.messages.at(-1)?.content ?? ''; return { text:`[MOCK] ${last}`, inputUnits:BigInt(last.length), outputUnits:BigInt(last.length+7), providerRequestId:`mock-${Date.now()}` }; } };
