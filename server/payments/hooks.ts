import type { PoolClient } from 'pg';
import { enqueueReferralTopup } from '../referrals/service';

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
 * Queues the «دعوت از دوستان» reward work on the outbox. It runs on the caller's tenant transaction,
 * so the event commits or rolls back together with the payment.
 */
export async function onVerifiedGatewayPayment(client: Pick<PoolClient, 'query'>, input: VerifiedGatewayPayment): Promise<void> {
  await enqueueReferralTopup(client, input);
}
