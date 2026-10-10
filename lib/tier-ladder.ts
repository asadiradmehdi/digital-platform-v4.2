// Pure loyalty-ladder maths shared by the server (getTierLadder) and the admin editor. Level names are fixed
// (میماس … اسد); only the cumulative paid-spend thresholds (toman) are editable. Level 1 always starts at 0.
import { TIERS, type Tier } from './tiers';

export const MAX_TIER_THRESHOLD = 1_000_000_000_000;

export function tierForLadder(ladder: readonly Tier[], spentToman: number) {
  let i = 0;
  while (i + 1 < ladder.length && spentToman >= ladder[i + 1].minToman) i++;
  const next = ladder[i + 1] ?? null;
  const progress = next ? (spentToman - ladder[i].minToman) / (next.minToman - ladder[i].minToman) : 1;
  const remainingToman = next ? Math.max(0, next.minToman - spentToman) : 0;
  return { tier: ladder[i], level: i + 1, levels: ladder.length, next, progress: Math.max(0, Math.min(1, progress)), remainingToman };
}

/** Returns an error message in Persian when the thresholds are not a valid ladder (strictly increasing, first = 0), else null. */
export function validateThresholds(mins: readonly number[]): string | null {
  if (mins.length !== TIERS.length) return 'تعداد سطح‌ها ثابت است.';
  if (mins[0] !== 0) return 'سطح اول همیشه از صفر شروع می‌شود.';
  for (let i = 0; i < mins.length; i++) {
    if (!Number.isSafeInteger(mins[i]) || mins[i] < 0 || mins[i] > MAX_TIER_THRESHOLD) return 'مبلغ‌ها باید عدد صحیح و معتبر باشند.';
    if (i > 0 && mins[i] <= mins[i - 1]) return `حد «${TIERS[i].name}» باید از حد «${TIERS[i - 1].name}» بیشتر باشد.`;
  }
  return null;
}

export function ladderFromThresholds(mins: readonly number[]): Tier[] {
  return TIERS.map((t, i) => ({ name: t.name, minToman: mins[i] ?? t.minToman }));
}
