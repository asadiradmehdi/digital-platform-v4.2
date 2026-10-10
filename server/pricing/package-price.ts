// Resolves what a package costs at order time. Used by createOrder and createCheckout so a pinned package
// price (service_package_prices) is what is charged, stored on the order item and verified at payment.
import type { PoolClient } from 'pg';

type Queryable = Pick<PoolClient, 'query'>;

export type ResolvedPackage = { totalMinor: bigint; unitMinor: bigint; pinned: boolean };

/** Active, approved pinned price for exactly this quantity, or null. */
export async function pinnedPackageMinor(client: Queryable, serviceId: string, quantity: bigint): Promise<bigint | null> {
  const r = await client.query<{ price_minor: string }>(
    `SELECT price_minor::text FROM service_package_prices
     WHERE service_id=$1 AND quantity=$2 AND active=true AND approval_status='APPROVED' AND currency='IRT'
       AND (effective_to IS NULL OR effective_to > now())
     LIMIT 1`,
    [serviceId, quantity.toString()],
  );
  return r.rows[0] ? BigInt(r.rows[0].price_minor) : null;
}

/**
 * Total for `quantity` of a service whose list unit price is `unitMinor`. A pinned package replaces
 * quantity × unit; the order item then records the implied (rounded) unit price while the total stays exact.
 */
export async function resolvePackageTotal(client: Queryable, serviceId: string, quantity: bigint, unitMinor: bigint): Promise<ResolvedPackage> {
  const pinned = await pinnedPackageMinor(client, serviceId, quantity);
  if (pinned === null) return { totalMinor: quantity * unitMinor, unitMinor, pinned: false };
  const implied = (pinned + quantity / 2n) / quantity;
  return { totalMinor: pinned, unitMinor: implied, pinned: true };
}
