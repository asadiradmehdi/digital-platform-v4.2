// Loyalty tier ladder (cumulative paid spend, toman). Defaults live in lib/tiers.ts; the owner can change the thresholds
// in the admin console (platform setting `loyalty.tiers`). Level names are fixed. `getTierLadder()` is the single read
// path for any server code that needs the ladder (customer web/app views should call it instead of importing TIERS).
import { getPlatformSetting } from '../core/platform-settings';
import { TIERS, type Tier } from '../../lib/tiers';
import { ladderFromThresholds, validateThresholds } from '../../lib/tier-ladder';

export { tierForLadder } from '../../lib/tier-ladder';
export const TIER_SETTINGS_KEY = 'loyalty.tiers';

export async function getTierLadder(): Promise<Tier[]> {
  try {
    const s = await getPlatformSetting<{ thresholds?: unknown }>(TIER_SETTINGS_KEY);
    const mins = s.value?.thresholds;
    if (Array.isArray(mins) && mins.every(n => typeof n === 'number') && validateThresholds(mins as number[]) === null) return ladderFromThresholds(mins as number[]);
  } catch { /* settings unavailable: fall back to the shipped ladder */ }
  return TIERS.map(t => ({ ...t }));
}
