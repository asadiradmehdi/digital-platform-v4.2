import { query, withTenantTransaction } from '../core/db';
import type { ProviderAdapter } from './contracts';
import { dispatchOrder } from './dispatch';

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
  // orders is RLS-protected: the scan and every per-order update run inside the caller's workspace.
  const r = await withTenantTransaction(workspaceId, undefined, client => client.query<{ order_id: string; external_order_id: string }>(
    `SELECT eo.order_id, eo.external_order_id
     FROM external_orders eo
     JOIN orders o ON o.id = eo.order_id
     WHERE eo.provider_id=$1 AND o.workspace_id=$2
       AND eo.status NOT IN ('COMPLETED','CANCELLED','FAILED')
     LIMIT $3`,
    [providerId, workspaceId, limit]
  ));

  const results: Array<{ orderId: string; externalOrderId: string; status: string; error?: string }> = [];
  for (const row of r.rows) {
    try {
      const result = await adapter.status(row.external_order_id, {
        correlationId: `poll:${row.order_id}`,
        idempotencyKey: `poll:${providerId}:${row.external_order_id}:${Date.now()}`,
      });
      const terminal = result.status === 'COMPLETED' ? 'COMPLETED' : ['FAILED', 'CANCELLED'].includes(result.status) ? 'FAILED' : null;
      // One transaction per order: the external status, the order status and its event commit together.
      await withTenantTransaction(workspaceId, undefined, async client => {
        await client.query(
          `UPDATE external_orders SET status=$2, updated_at=now() WHERE external_order_id=$1 AND provider_id=$3`,
          [row.external_order_id, result.status, providerId]
        );
        // Propagate terminal states to the parent order.
        if (!terminal) return;
        const current = await client.query<{ status: string }>(`SELECT status FROM orders WHERE id=$1 FOR UPDATE`, [row.order_id]);
        const fromStatus = current.rows[0]?.status;
        if (fromStatus === 'PROCESSING' || fromStatus === 'PROVIDER_SUBMITTED') {
          await client.query(`UPDATE orders SET status=$2, updated_at=now() WHERE id=$1`, [row.order_id, terminal]);
          await client.query(
            `INSERT INTO order_events(order_id, from_status, to_status, metadata) VALUES($1,$2,$3,$4)`,
            [row.order_id, fromStatus, terminal, terminal === 'COMPLETED'
              ? { source: 'provider_poll', externalOrderId: row.external_order_id }
              : { source: 'provider_poll', externalOrderId: row.external_order_id, providerStatus: result.status }]
          );
        }
      });
      results.push({ orderId: row.order_id, externalOrderId: row.external_order_id, status: result.status });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      results.push({ orderId: row.order_id, externalOrderId: row.external_order_id, status: 'UNKNOWN', error: errorMsg });
    }
  }
  return results;
}

/**
 * Find and re-dispatch orders that have been in QUEUED state for longer than staleMinutes
 * (default 15) and have no external_order record. This prevents orders from getting stuck
 * if the outbox processor failed before dispatching.
 */
export async function recoverStuckQueuedOrders(staleMinutes = 15, limit = 20): Promise<{ orderId: string; result: string }[]> {
  // Cross-tenant scan: system_stale_queued_orders() (migration 0031) returns only routing ids; each
  // order is then handled inside its own workspace's RLS context.
  const staleOrders = await query<{ order_id: string; workspace_id: string; service_id: string }>(
    `SELECT order_id, workspace_id, service_id FROM system_stale_queued_orders($1, $2)`,
    [staleMinutes, limit],
  );

  const results: { orderId: string; result: string }[] = [];
  for (const row of staleOrders.rows) {
    try {
      await dispatchOrder({ workspaceId: row.workspace_id, orderId: row.order_id, serviceId: row.service_id });
      results.push({ orderId: row.order_id, result: 'dispatched' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      // Mark as FAILED if all providers exhausted (UNAVAILABLE error).
      if (msg.includes('UNAVAILABLE') || msg.includes('provider')) {
        await withTenantTransaction(row.workspace_id, undefined, async client => {
          const changed = await client.query<{ id: string }>(
            `UPDATE orders SET status='FAILED', updated_at=now() WHERE id=$1 AND status='QUEUED' RETURNING id`,
            [row.order_id],
          );
          if (changed.rows[0]) {
            await client.query(
              `INSERT INTO order_events(order_id,from_status,to_status,metadata) VALUES($1,'QUEUED','FAILED',$2)`,
              [row.order_id, { source: 'stuck_recovery', error: msg }],
            );
          }
        });
      }
      results.push({ orderId: row.order_id, result: `error: ${msg}` });
    }
  }
  return results;
}
