import { query } from '../core/db';
import type { ProviderAdapter } from './contracts';

/** Records a health check result for a provider. */
export async function recordProviderHealth(providerId: string, status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY', latencyMs: number, error?: string) {
  await query(
    `INSERT INTO provider_health_checks(provider_id, status, latency_ms, error)
     VALUES($1,$2,$3,$4)`,
    [providerId, status, latencyMs, error ?? null]
  );
}

/** Returns the most recent health check for each provider. */
export async function getProviderHealthSummary() {
  const r = await query(
    `SELECT DISTINCT ON (ph.provider_id)
       ph.provider_id, ph.status, ph.latency_ms, ph.error, ph.checked_at,
       p.name AS provider_name, p.type AS provider_type
     FROM provider_health_checks ph
     JOIN providers p ON p.id = ph.provider_id
     ORDER BY ph.provider_id, ph.checked_at DESC`
  );
  return r.rows;
}

/** Polls a provider's balance (if supported) and records the result. */
export async function pollProviderBalance(
  providerId: string,
  adapter: ProviderAdapter
): Promise<{ amountMinor: bigint; currency: string } | null> {
  if (!adapter.balance) return null;
  const start = Date.now();
  try {
    const balance = await adapter.balance();
    const latencyMs = Date.now() - start;
    await recordProviderHealth(providerId, 'HEALTHY', latencyMs);
    return balance;
  } catch (err) {
    const latencyMs = Date.now() - start;
    await recordProviderHealth(providerId, 'UNHEALTHY', latencyMs, err instanceof Error ? err.message : 'Unknown error');
    return null;
  }
}

/**
 * Polls the status of PROCESSING external orders and updates them.
 * Called by the background worker on a schedule.
 */
export async function pollProcessingOrders(
  adapter: ProviderAdapter,
  providerId: string,
  workspaceId: string,
  limit = 50
) {
  const r = await query<{ order_id: string; external_order_id: string }>(
    `SELECT eo.order_id, eo.external_order_id
     FROM external_orders eo
     JOIN orders o ON o.id = eo.order_id
     WHERE eo.provider_id=$1 AND o.workspace_id=$2
       AND eo.status NOT IN ('COMPLETED','CANCELLED','FAILED')
     LIMIT $3`,
    [providerId, workspaceId, limit]
  );

  const results: Array<{ orderId: string; externalOrderId: string; status: string; error?: string }> = [];
  for (const row of r.rows) {
    try {
      const result = await adapter.status(row.external_order_id, {
        correlationId: `poll:${row.order_id}`,
        idempotencyKey: `poll:${providerId}:${row.external_order_id}:${Date.now()}`,
      });
      await query(
        `UPDATE external_orders SET status=$2, updated_at=now() WHERE external_order_id=$1 AND provider_id=$3`,
        [row.external_order_id, result.status, providerId]
      );
      results.push({ orderId: row.order_id, externalOrderId: row.external_order_id, status: result.status });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      results.push({ orderId: row.order_id, externalOrderId: row.external_order_id, status: 'UNKNOWN', error: errorMsg });
    }
  }
  return results;
}
