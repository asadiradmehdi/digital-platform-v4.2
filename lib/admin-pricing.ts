// Pure price helpers shared by the admin pricing UI (live preview) and server (bulk apply), so both agree.
const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';

/** «۱٬۲۰۰» / "1,200" / Arabic digits → 1200. Returns null for anything that is not a positive whole number. */
export function parseToman(input: string): number | null {
  const t = input.trim()
    .replace(/[۰-۹]/g, d => String(FA.indexOf(d))).replace(/[٠-٩]/g, d => String(AR.indexOf(d)))
    .replace(/[\s,٬،]/g, '');
  if (!/^\d{1,9}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}

export const ROUND_STEPS = [0, 100, 1000] as const;

/**
 * New per-unit price after a percent change. Rounding applies to the price of one pack (`per` units, e.g. 1000
 * followers); the stored unit price must stay a whole toman, so the result is pack/per rounded, never below 1.
 */
export function bulkNewUnit(oldUnit: number, percent: number, roundTo: number, per: number): number {
  const pack = oldUnit * (1 + percent / 100) * per;
  const rounded = roundTo > 1 ? Math.round(pack / roundTo) * roundTo : pack;
  return Math.max(1, Math.round(rounded / per));
}
