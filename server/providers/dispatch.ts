import { query } from '../core/db';
import { AppError } from '../core/errors';
import { chooseProvider, scoreProvider, type ProviderCandidate } from './routing';
import { providerRetryDecision } from './retry';
import { getProviderCredentials } from './credential-vault';
import { createAdapter, hasAdapter } from './adapter-registry';
import { submitQueuedOrder } from '../queue/order-worker';

type DispatchInput = {
  workspaceId: string;
  orderId: string;
  serviceId: string;
  maxFailoverAttempts?: number;
};

type DispatchResult = {
  providerId: string;
  externalOrderId: string;
  status: string;
  attempts: number;
};

async function loadCandidates(serviceId: string): Promise<ProviderCandidate[]> {
  const r = await query<{
    provider_id: string; provider_type: string; available: boolean;
    success_rate: string | null; refund_rate: string | null;
    latency_ms: string | null; quality_score: string | null;
    cost_minor: string | null; balance_healthy: boolean;
  }>(
    `SELECT
       pr.provider_id,
       p.provider_type,
       (p.status = 'ACTIVE') AS available,
       COALESCE(pm.success_rate::text, '0.9') AS success_rate,
       COALESCE(pm.refund_rate::text, '0.05') AS refund_rate,
       COALESCE(pm.latency_ms::text, '500') AS latency_ms,
       COALESCE(pm.quality_score::text, '0.8') AS quality_score,
       COALESCE(ps.cost_minor::text, '1000') AS cost_minor,
       (
         p.balance_minor IS NULL OR p.balance_minor > 1000
       ) AS balance_healthy
     FROM provider_routes pr
     JOIN providers p ON p.id = pr.provider_id
     LEFT JOIN LATERAL (
       SELECT success_rate, refund_rate, latency_ms, quality_score
       FROM provider_metrics
       WHERE provider_id = pr.provider_id AND (service_id = pr.service_id OR service_id IS NULL)
       ORDER BY captured_at DESC LIMIT 1
     ) pm ON true
     LEFT JOIN provider_services ps ON ps.provider_id = pr.provider_id AND ps.service_id = pr.service_id
     WHERE pr.service_id = $1 AND pr.active = true
     ORDER BY pr.priority ASC, pr.weight DESC`,
    [serviceId]
  );

  return r.rows.map(row => ({
    providerId: row.provider_id,
    successRate: parseFloat(row.success_rate ?? '0.9'),
    refundRate: parseFloat(row.refund_rate ?? '0.05'),
    latencyMs: parseInt(row.latency_ms ?? '500', 10),
    qualityScore: parseFloat(row.quality_score ?? '0.8'),
    costMinor: parseInt(row.cost_minor ?? '1000', 10),
    balanceHealthy: row.balance_healthy,
    available: row.available,
  }));
}

async function getProviderServiceInfo(providerId: string, serviceId: string) {
  const r = await query<{ provider_type: string; external_service_id: string; provider_service_id: string }>(
    `SELECT p.provider_type, ps.external_service_id, ps.id AS provider_service_id
     FROM providers p
     JOIN provider_services ps ON ps.provider_id = p.id AND ps.service_id = $2
     WHERE p.id = $1`,
    [providerId, serviceId]
  );
  return r.rows[0] ?? null;
}

export async function dispatchOrder(input: DispatchInput): Promise<DispatchResult> {
  const candidates = await loadCandidates(input.serviceId);
  if (!candidates.length) throw new AppError('UNAVAILABLE', 'No active provider routes for this service.');

  const available = candidates.filter(c => c.available && c.balanceHealthy && hasAdapter(c.providerId) || true);
  const ranked = [...available].sort((a, b) => scoreProvider(b) - scoreProvider(a));

  const maxAttempts = Math.min(input.maxFailoverAttempts ?? 3, ranked.length);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = ranked[attempt];
    if (!candidate) break;
    const provInfo = await getProviderServiceInfo(candidate.providerId, input.serviceId);
    if (!provInfo) continue;

    let credentials: Record<string, string>;
    try {
      credentials = await getProviderCredentials(candidate.providerId);
    } catch {
      continue;
    }

    let adapter;
    try {
      adapter = createAdapter(provInfo.provider_type, credentials);
    } catch {
      continue;
    }

    try {
      const result = await submitQueuedOrder({
        workspaceId: input.workspaceId,
        orderId: input.orderId,
        providerId: candidate.providerId,
        providerServiceId: provInfo.provider_service_id,
        adapter,
        externalServiceId: provInfo.external_service_id,
      });

      if ('skipped' in result && result.skipped) {
        return {
          providerId: candidate.providerId,
          externalOrderId: ('externalOrderId' in result ? result.externalOrderId : '') ?? '',
          status: 'SKIPPED',
          attempts: attempt + 1,
        };
      }

      return {
        providerId: candidate.providerId,
        externalOrderId: (result as { externalOrderId: string }).externalOrderId,
        status: (result as { status: string }).status,
        attempts: attempt + 1,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const decision = providerRetryDecision({
        attempt: attempt + 1,
        maxAttempts,
        transportFailed: true,
        externalOrderCreatedUnknown: lastError.message.includes('external-order-state-unknown'),
      });
      if (!decision.retry) break;
    }
  }

  throw new AppError('UNAVAILABLE', `All providers failed. Last error: ${lastError?.message ?? 'unknown'}`);
}
