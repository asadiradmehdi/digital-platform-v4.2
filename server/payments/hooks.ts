import type { PoolClient } from 'pg';

export type VerifiedGatewayPayment = {
  workspaceId: string;
  paymentId: string;
  /** The verified amount in wallet minor units (IRR). */
  amountMinor: bigint;
  currency: 'IRR';
};

/**
 * Called inside the transaction that records a gateway-verified payment as PAID (wallet top-up or
 * direct order/checkout payment), exactly once per payment. Wallet-balance payments never call it.
 * Intentionally a no-op for now; the referral program wires its top-up bonus in here
 * (enqueueReferralTopup). It runs on the caller's tenant transaction, so whatever it writes commits
 * or rolls back together with the payment.
 */
export async function onVerifiedGatewayPayment(client: Pick<PoolClient, 'query'>, input: VerifiedGatewayPayment): Promise<void> {
  void client;
  void input;
}
