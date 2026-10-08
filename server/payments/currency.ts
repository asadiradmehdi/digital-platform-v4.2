import { AppError } from '../core/errors';

/**
 * Convert an amount into the wallet ledger's currency.
 * Orders are priced in toman (IRT) while wallet ledgers are kept in rial (IRR): 1 toman = 10 rial.
 * Any other pair must match exactly; mixing currencies in one ledger is refused.
 */
export function toWalletMinor(amountMinor: bigint, from: string, to: string): bigint {
  const f = from.trim(), t = to.trim();
  if (f === t) return amountMinor;
  if (f === 'IRT' && t === 'IRR') return amountMinor * 10n;
  throw new AppError('CONFLICT', `Cannot post a ${f} amount to a ${t} wallet.`);
}
