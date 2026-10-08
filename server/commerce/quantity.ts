import { AppError } from '../core/errors';

/**
 * Enforce a service price's min/max quantity on the server. The UI only offers packages inside the
 * bounds, but an API caller could otherwise order below the provider minimum or above the maximum.
 */
export function assertQuantityWithinBounds(quantity: bigint, minQuantity: string | number | bigint | null | undefined, maxQuantity: string | number | bigint | null | undefined): void {
  const min = minQuantity == null ? null : BigInt(minQuantity);
  const max = maxQuantity == null ? null : BigInt(maxQuantity);
  const fa = (n: bigint) => new Intl.NumberFormat('fa-IR').format(n);
  if (min != null && quantity < min) {
    throw new AppError('VALIDATION_ERROR', `حداقل تعداد برای این سرویس ${fa(min)} است.`, { minQuantity: min.toString(), quantity: quantity.toString() });
  }
  if (max != null && quantity > max) {
    throw new AppError('VALIDATION_ERROR', `حداکثر تعداد برای این سرویس ${fa(max)} است.`, { maxQuantity: max.toString(), quantity: quantity.toString() });
  }
}
