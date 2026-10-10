// Loyalty levels: Saturn's moons, «ریچی» and, at the top, «اسد» (named by the owner, 2026-10-08).
// Display only: a level is derived from lifetime paid spend and grants no price change by itself.
export type Tier = { name: string; minToman: number };

export const TIERS: Tier[] = [
  { name: 'میماس', minToman: 0 },
  { name: 'تتیس', minToman: 1_000_000 },
  { name: 'ریچی', minToman: 5_000_000 },
  { name: 'تایتان', minToman: 10_000_000 },
  { name: 'اسد', minToman: 25_000_000 },
];

export function tierFor(spentToman: number) {
  let i = 0;
  while (i + 1 < TIERS.length && spentToman >= TIERS[i + 1].minToman) i++;
  const next = TIERS[i + 1] ?? null;
  const progress = next ? (spentToman - TIERS[i].minToman) / (next.minToman - TIERS[i].minToman) : 1;
  // `remainingToman` is what is still to be spent for the next level, so the wording can say it plainly.
  const remainingToman = next ? Math.max(0, next.minToman - spentToman) : 0;
  return { tier: TIERS[i], level: i + 1, levels: TIERS.length, next, progress: Math.max(0, Math.min(1, progress)), remainingToman };
}
