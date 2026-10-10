// Owner-controlled site switches (platform setting `site.switches`), enforced on the server:
//  - signupsOpen=false  -> no new account can be created (createAccountWithWorkspace), existing users sign in as usual.
//  - maintenance=true   -> customers cannot create new orders or checkouts; browsing, sign-in, wallet and support keep working.
// Defaults (no row): signups open, maintenance off. Reads are cached ~30s by platform-settings; a save clears the cache.
import { getPlatformSetting } from './platform-settings';
import { AppError } from './errors';

export const SITE_SWITCHES_KEY = 'site.switches';
export type SiteSwitches = { maintenance: boolean; signupsOpen: boolean; maintenanceMessage: string };
export const DEFAULT_MAINTENANCE_MESSAGE = 'در حال به‌روزرسانی هستیم؛ ثبت سفارش جدید موقتاً متوقف است. کمی بعد دوباره سر بزنید.';

export async function getSiteSwitches(): Promise<SiteSwitches> {
  const s = await getPlatformSetting<Partial<SiteSwitches>, never>(SITE_SWITCHES_KEY);
  const v = s.value ?? {};
  return {
    maintenance: v.maintenance === true,
    signupsOpen: v.signupsOpen !== false,
    maintenanceMessage: typeof v.maintenanceMessage === 'string' && v.maintenanceMessage.trim() ? v.maintenanceMessage : DEFAULT_MAINTENANCE_MESSAGE,
  };
}

export async function assertSignupsOpen() {
  if (!(await getSiteSwitches()).signupsOpen) throw new AppError('FORBIDDEN', 'ثبت‌نام حساب جدید فعلاً بسته است. اگر قبلاً حساب دارید وارد شوید.');
}
export async function assertNotInMaintenance() {
  const s = await getSiteSwitches();
  if (s.maintenance) throw new AppError('UNAVAILABLE', s.maintenanceMessage);
}
