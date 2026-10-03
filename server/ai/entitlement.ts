import { query } from '../core/db';
import { AppError } from '../core/errors';
import { getModelPrice } from './model-catalog';

export function estimateAICost(inputUnits: bigint, outputUnits: bigint, pricePerK: { inputPriceMinorPer1K: bigint; outputPriceMinorPer1K: bigint }): bigint {
  return (inputUnits * pricePerK.inputPriceMinorPer1K + outputUnits * pricePerK.outputPriceMinorPer1K) / 1000n;
}

export async function checkAIEntitlement(workspaceId: string, modelId: string): Promise<void> {
  const r = await query<{ has_access: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       JOIN plan_entitlements pe ON pe.plan_id = p.id
       WHERE s.workspace_id=$1
         AND s.status IN ('ACTIVE','TRIALING')
         AND pe.entitlement_key='ai_access'
         AND (pe.value->>'enabled')::boolean = true
     ) AS has_access`,
    [workspaceId]
  );
  const hasAccess = r.rows[0]?.has_access ?? false;
  if (!hasAccess) throw new AppError('PAYMENT_REQUIRED', 'Your plan does not include AI access. Please upgrade.');

  const price = await getModelPrice(modelId);
  if (!price) throw new AppError('NOT_FOUND', 'Model pricing not configured.');
}

export async function checkWalletBalance(workspaceId: string, requiredMinor: bigint, currency: string): Promise<void> {
  const r = await query<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN entry_type='CREDIT' THEN amount_minor ELSE -amount_minor END), 0)::text AS balance
     FROM ledger_entries
     WHERE workspace_id=$1 AND currency=$2`,
    [workspaceId, currency]
  );
  const balance = BigInt(r.rows[0]?.balance ?? '0');
  if (balance < requiredMinor) {
    throw new AppError('PAYMENT_REQUIRED', `Insufficient balance. Required: ${requiredMinor}, available: ${balance}.`);
  }
}

export async function recordAIRequest(input: {
  workspaceId: string;
  modelId: string;
  requestType: string;
  idempotencyKey: string;
}): Promise<string> {
  const r = await query<{ id: string }>(
    `INSERT INTO ai_requests(workspace_id, ai_model_id, request_type, status, idempotency_key)
     VALUES($1,$2,$3,'PROCESSING',$4)
     ON CONFLICT(workspace_id, idempotency_key) DO UPDATE SET status='PROCESSING'
     RETURNING id`,
    [input.workspaceId, input.modelId, input.requestType, input.idempotencyKey]
  );
  return r.rows[0]?.id ?? '';
}

export async function completeAIRequest(aiRequestId: string, inputUnits: bigint, outputUnits: bigint, latencyMs: number): Promise<void> {
  await query(
    `UPDATE ai_requests SET status='COMPLETED', input_units=$2, output_units=$3, latency_ms=$4, completed_at=now() WHERE id=$1`,
    [aiRequestId, inputUnits.toString(), outputUnits.toString(), latencyMs]
  );
}

export async function failAIRequest(aiRequestId: string): Promise<void> {
  await query(`UPDATE ai_requests SET status='FAILED', completed_at=now() WHERE id=$1`, [aiRequestId]);
}
