import type { OrderStatus } from '../core/order-state';
export type ProviderContext = { correlationId: string; idempotencyKey: string; signal?: AbortSignal };
export type ProviderSubmitInput = { externalServiceId: string; quantity: bigint; parameters: Record<string, unknown> };
export type ProviderSubmitResult = { externalOrderId: string; status: OrderStatus; raw?: unknown };
export interface ProviderAdapter {
  readonly providerType: string;
  submit(input: ProviderSubmitInput, context: ProviderContext): Promise<ProviderSubmitResult>;
  status(externalOrderId: string, context: ProviderContext): Promise<{ status: OrderStatus; raw?: unknown }>;
  cancel?(externalOrderId: string, context: ProviderContext): Promise<void>;
  balance?(): Promise<{ amountMinor: bigint; currency: string }>;
}
