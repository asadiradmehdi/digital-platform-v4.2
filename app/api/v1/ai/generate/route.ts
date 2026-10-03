import { NextRequest, NextResponse } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { anthropicAdapter } from '../../../../../server/ai/providers/anthropic';
import { openaiAdapter } from '../../../../../server/ai/providers/openai';
import { AIGateway } from '../../../../../server/ai/gateway';
import { resolveModelId, getModelPrice } from '../../../../../server/ai/model-catalog';
import { checkAIEntitlement, recordAIRequest, completeAIRequest, failAIRequest, estimateAICost } from '../../../../../server/ai/entitlement';
import { recordAICost } from '../../../../../server/ai/cost-accounting';
import { createStreamingResponse } from '../../../../../server/ai/streaming';
import { query } from '../../../../../server/core/db';
import { randomUUID } from 'node:crypto';

const gateway = new AIGateway([
  { model: 'claude-haiku-4-5-20251001', provider: 'anthropic', adapter: anthropicAdapter, enabled: true, priority: 1 },
  { model: 'claude-sonnet-4-6', provider: 'anthropic', adapter: anthropicAdapter, enabled: true, priority: 1 },
  { model: 'claude-opus-4-7', provider: 'anthropic', adapter: anthropicAdapter, enabled: true, priority: 1 },
  { model: 'gpt-4o', provider: 'openai', adapter: openaiAdapter, enabled: true, priority: 2 },
  { model: 'gpt-4o-mini', provider: 'openai', adapter: openaiAdapter, enabled: true, priority: 2 },
]);

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const body = await request.json() as {
      workspaceId: string;
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      maxOutputTokens?: number;
      stream?: boolean;
      idempotencyKey?: string;
    };

    const { workspaceId, model, messages, temperature, maxOutputTokens, stream } = body;
    if (!workspaceId || !model || !messages?.length) {
      return json({ error: 'workspaceId, model, and messages are required.' }, { status: 400, correlationId: id });
    }

    await requireWorkspacePermission(userId, workspaceId, 'ai.generate');

    const modelId = await resolveModelId(model);
    if (!modelId) return json({ error: `Model ${model} not found.` }, { status: 404, correlationId: id });

    await checkAIEntitlement(workspaceId, modelId);

    const idempKey = body.idempotencyKey ?? `ai:gen:${randomUUID()}`;
    const aiRequestId = await recordAIRequest({ workspaceId, modelId, requestType: 'generate', idempotencyKey: idempKey });

    const aiInput = {
      model,
      messages: messages as Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>,
      temperature,
      maxOutputTokens,
    };

    if (stream) {
      const controller = new AbortController();
      request.signal.addEventListener('abort', () => controller.abort());
      const streamBody = createStreamingResponse(aiInput, controller.signal);
      return new NextResponse(streamBody, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'x-correlation-id': id,
          'x-ai-request-id': aiRequestId,
        },
      });
    }

    const start = Date.now();
    const result = await gateway.generate(aiInput, request.signal);
    const latencyMs = Date.now() - start;

    await completeAIRequest(aiRequestId, result.inputUnits, result.outputUnits, latencyMs);

    const price = await getModelPrice(modelId);
    if (price) {
      const costMinor = estimateAICost(result.inputUnits, result.outputUnits, price);
      await recordAICost({
        query: (sql, params) => query(sql, params as unknown[]),
        aiRequestId,
        workspaceId,
        providerId: modelId,
        modelId,
        currency: price.currency,
        inputUnits: result.inputUnits,
        outputUnits: result.outputUnits,
        costMinor,
      });
    }

    return json({
      aiRequestId,
      text: result.text,
      inputUnits: result.inputUnits.toString(),
      outputUnits: result.outputUnits.toString(),
      providerRequestId: result.providerRequestId,
    }, { correlationId: id });
  } catch (e) {
    // best-effort: mark request failed if we have an ID
    return handleRouteError(e, id);
  }
}
