import { query } from '../core/db';

export type ModelDefinition = {
  providerName: string;
  modelKey: string;
  displayName: string;
  contextLimit: number;
  capabilities: Record<string, unknown>;
  inputPriceMinorPer1K: number;
  outputPriceMinorPer1K: number;
  currency: string;
};

export const KNOWN_MODELS: ModelDefinition[] = [
  { providerName: 'anthropic', modelKey: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5', contextLimit: 200000, capabilities: { vision: true, streaming: true }, inputPriceMinorPer1K: 80, outputPriceMinorPer1K: 400, currency: 'USD' },
  { providerName: 'anthropic', modelKey: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', contextLimit: 200000, capabilities: { vision: true, streaming: true }, inputPriceMinorPer1K: 300, outputPriceMinorPer1K: 1500, currency: 'USD' },
  { providerName: 'anthropic', modelKey: 'claude-opus-4-7', displayName: 'Claude Opus 4.7', contextLimit: 200000, capabilities: { vision: true, streaming: true }, inputPriceMinorPer1K: 1500, outputPriceMinorPer1K: 7500, currency: 'USD' },
  { providerName: 'openai', modelKey: 'gpt-4o', displayName: 'GPT-4o', contextLimit: 128000, capabilities: { vision: true, streaming: true }, inputPriceMinorPer1K: 250, outputPriceMinorPer1K: 1000, currency: 'USD' },
  { providerName: 'openai', modelKey: 'gpt-4o-mini', displayName: 'GPT-4o mini', contextLimit: 128000, capabilities: { vision: true, streaming: true }, inputPriceMinorPer1K: 15, outputPriceMinorPer1K: 60, currency: 'USD' },
];

export async function syncModelCatalog(models: ModelDefinition[] = KNOWN_MODELS): Promise<void> {
  for (const m of models) {
    const providerRow = await query<{ id: string }>(
      `INSERT INTO ai_providers(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      [m.providerName]
    );
    const providerId = providerRow.rows[0]?.id;
    if (!providerId) continue;

    const modelRow = await query<{ id: string }>(
      `INSERT INTO ai_models(ai_provider_id, model_key, display_name, context_limit, capabilities)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(ai_provider_id, model_key) DO UPDATE
         SET display_name=EXCLUDED.display_name,
             context_limit=EXCLUDED.context_limit,
             capabilities=EXCLUDED.capabilities,
             active=true
       RETURNING id`,
      [providerId, m.modelKey, m.displayName, m.contextLimit, m.capabilities]
    );
    const modelId = modelRow.rows[0]?.id;
    if (!modelId) continue;

    await query(
      `INSERT INTO ai_model_prices(ai_model_id, input_price_minor, output_price_minor, currency)
       VALUES($1,$2,$3,$4)
       ON CONFLICT DO NOTHING`,
      [modelId, m.inputPriceMinorPer1K, m.outputPriceMinorPer1K, m.currency]
    );
  }
}

export async function getModelPrice(modelId: string): Promise<{ inputPriceMinorPer1K: bigint; outputPriceMinorPer1K: bigint; currency: string } | null> {
  const r = await query<{ input_price_minor: string; output_price_minor: string; currency: string }>(
    `SELECT input_price_minor, output_price_minor, currency FROM ai_model_prices WHERE ai_model_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [modelId]
  );
  if (!r.rows[0]) return null;
  return {
    inputPriceMinorPer1K: BigInt(r.rows[0].input_price_minor),
    outputPriceMinorPer1K: BigInt(r.rows[0].output_price_minor),
    currency: r.rows[0].currency,
  };
}

export async function resolveModelId(modelKey: string): Promise<string | null> {
  const r = await query<{ id: string }>(
    `SELECT m.id FROM ai_models m JOIN ai_providers p ON p.id=m.ai_provider_id WHERE m.model_key=$1 AND m.active=true AND p.status='ACTIVE' LIMIT 1`,
    [modelKey]
  );
  return r.rows[0]?.id ?? null;
}
