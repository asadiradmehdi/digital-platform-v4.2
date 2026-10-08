// Loyalty levels named after the moons of Saturn, crowned by «کیوان» (Saturn in Persian astronomy).
// Display only: a level is derived from lifetime paid spend and grants no price change by itself.
export type Tier = { name: string; minToman: number };

export const TIERS: Tier[] = [
  { name: 'میماس', minToman: 0 },
  { name: 'تتیس', minToman: 1_000_000 },
  { name: 'رئا', minToman: 5_000_000 },
  { name: 'تیتان', minToman: 20_000_000 },
  { name: 'کیوان', minToman: 50_000_000 },
];

export function tierFor(spentToman: number) {
  let i = 0;
  while (i + 1 < TIERS.length && spentToman >= TIERS[i + 1].minToman) i++;
  const next = TIERS[i + 1] ?? null;
  const progress = next ? (spentToman - TIERS[i].minToman) / (next.minToman - TIERS[i].minToman) : 1;
  return { tier: TIERS[i], level: i + 1, levels: TIERS.length, next, progress: Math.max(0, Math.min(1, progress)) };
}
