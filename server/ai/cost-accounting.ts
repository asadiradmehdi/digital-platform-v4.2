import { AppError } from '../core/errors';

export type AICostUnit = '1K_INPUT_TOKENS'|'1K_OUTPUT_TOKENS'|'IMAGE'|'VIDEO_SECOND'|'AUDIO_MINUTE'|'REQUEST';
export type AICostLine = { unit: AICostUnit; quantity: bigint; priceMinor: bigint; currency: string };

export function calculateAICost(lines: AICostLine[]) {
  if (!lines.length) throw new AppError('VALIDATION_ERROR','AI cost requires at least one usage line.');
  const currency = lines[0].currency;
  let total = 0n;
  for (const line of lines) {
    if (line.currency !== currency || line.quantity < 0n || line.priceMinor < 0n) throw new AppError('VALIDATION_ERROR','Invalid AI cost line.');
    total += line.quantity * line.priceMinor;
  }
  return { totalMinor: total, currency };
}

export async function recordAICost(input:{query:(sql:string,params?:unknown[])=>Promise<unknown>; aiRequestId:string; workspaceId:string; providerId:string; modelId:string; currency:string; inputUnits:bigint; outputUnits:bigint; costMinor:bigint; metadata?:Record<string,unknown>}) {
  if (input.costMinor < 0n) throw new AppError('VALIDATION_ERROR','AI cost cannot be negative.');
  await input.query(`INSERT INTO ai_cost_events(ai_request_id,workspace_id,ai_provider_id,ai_model_id,input_units,output_units,cost_minor,currency,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [input.aiRequestId,input.workspaceId,input.providerId,input.modelId,input.inputUnits.toString(),input.outputUnits.toString(),input.costMinor.toString(),input.currency,input.metadata ?? {}]);
}
