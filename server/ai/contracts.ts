export type AIMessage = { role: 'system'|'user'|'assistant'|'tool'; content: string };
export type AIRequest = { model: string; messages: AIMessage[]; temperature?: number; maxOutputTokens?: number; metadata?: Record<string, unknown> };
export type AIResponse = { text: string; inputUnits: bigint; outputUnits: bigint; providerRequestId?: string; raw?: unknown };
export interface AIProviderAdapter { readonly provider: string; generate(input: AIRequest, signal?: AbortSignal): Promise<AIResponse>; }
