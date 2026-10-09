// Wallet top-up amounts, shared by the server (validation), the website and the app (UI).
// The customer chooses toman; the gateway is charged the same amount in rial (toman × 10).
import { toAsciiDigits } from './phone';

/** Quick-pick amounts in toman: ۲۰۰ هزار … ۱۰ میلیون (six boxes). */
export const TOPUP_PRESETS_TOMAN = [200_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000] as const;
/** Smallest custom amount (the gateways' practical floor). */
export const TOPUP_MIN_TOMAN = 10_000;
/** Largest single payment: the Shaparak per-transaction ceiling (۵۰ میلیون تومان). */
export const TOPUP_MAX_TOMAN = 50_000_000;

/** Parse what the customer typed (Persian/Arabic/Latin digits, ٬ , separators) into whole toman, or null. */
export function parseTomanInput(raw: string): number | null {
  const digits = toAsciiDigits(raw).replace(/[\s,٬،_.]/g, '');
  if (!/^\d{1,12}$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** Persian message when the amount is outside the allowed range, else null. */
export function topupAmountProblem(toman: number): string | null {
  if (!Number.isSafeInteger(toman) || toman <= 0) return 'مبلغ را به تومان وارد کنید.';
  if (toman < TOPUP_MIN_TOMAN) return 'حداقل مبلغ شارژ ۱۰ هزار تومان است.';
  if (toman > TOPUP_MAX_TOMAN) return 'حداکثر مبلغ هر پرداخت ۵۰ میلیون تومان است.';
  return null;
}

/** Rial charged by the gateway for a toman amount. */
export const tomanToRial = (toman: number) => toman * 10;

/** Top-up to suggest for a shortfall: rounded up to the next ۱۰ هزار, never below the minimum. */
export function suggestedTopupToman(shortfallToman: number): number {
  const rounded = Math.ceil(Math.max(shortfallToman, 0) / 10_000) * 10_000;
  return Math.min(Math.max(rounded, TOPUP_MIN_TOMAN), TOPUP_MAX_TOMAN);
}
