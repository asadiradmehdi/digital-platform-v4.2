// Admin permission catalogue shared by the server (enforcement) and the team UI (matrix, presets). The owner (platform_admin) holds
// everything implicitly. A permission never implies another by itself, but granting an "edit"-level key always adds its "view" key
// (normalizePermissions), so nobody can be left able to change something they cannot see.

export type PermissionKey =
  | 'orders.view' | 'orders.manage' | 'refunds.process'
  | 'support.view' | 'support.manage'
  | 'catalog.view' | 'catalog.edit' | 'catalog.approve'
  | 'users.view' | 'users.manage' | 'wallet.adjust'
  | 'invoices.view' | 'invoices.edit'
  | 'notifications.manage'
  | 'settings.view' | 'settings.edit'
  | 'audit.view'
  | 'team.manage';

export type PermissionDef = { key: PermissionKey; label: string; hint: string; requires?: PermissionKey };
export type PermissionGroup = { id: string; label: string; items: PermissionDef[] };

export const PERMISSION_GROUPS: PermissionGroup[] = [
  { id: 'orders', label: 'سفارش‌ها', items: [
    { key: 'orders.view', label: 'دیدن سفارش‌ها', hint: 'فهرست، جزئیات و روند سفارش' },
    { key: 'orders.manage', label: 'مدیریت سفارش', hint: 'تغییر وضعیت، یادداشت، تحویل', requires: 'orders.view' },
    { key: 'refunds.process', label: 'بازگشت وجه و لغو', hint: 'برگرداندن پول سفارش', requires: 'orders.view' },
  ] },
  { id: 'support', label: 'پشتیبانی', items: [
    { key: 'support.view', label: 'دیدن تیکت‌ها', hint: 'فهرست و گفتگوها' },
    { key: 'support.manage', label: 'پاسخ و مدیریت تیکت', hint: 'پاسخ، بستن، ارجاع', requires: 'support.view' },
  ] },
  { id: 'catalog', label: 'خدمات و قیمت‌ها', items: [
    { key: 'catalog.view', label: 'دیدن خدمات و قیمت‌ها', hint: 'فقط مشاهده' },
    { key: 'catalog.edit', label: 'ویرایش خدمات', hint: 'عنوان، توضیح، روشن/خاموش، پیش‌نویس قیمت', requires: 'catalog.view' },
    { key: 'catalog.approve', label: 'تأیید و اعمال قیمت', hint: 'تغییر قیمت زنده، تأیید پیش‌نویس، بازگشت', requires: 'catalog.view' },
  ] },
  { id: 'users', label: 'کاربران و کیف پول', items: [
    { key: 'users.view', label: 'دیدن کاربران', hint: 'مشخصات، سطح، موجودی و تراکنش‌ها' },
    { key: 'users.manage', label: 'مسدود/فعال‌سازی کاربر', hint: 'مسدود کردن و بازکردن حساب', requires: 'users.view' },
    { key: 'wallet.adjust', label: 'افزایش/کاهش موجودی', hint: 'اصلاح دستی کیف پول با ثبت دلیل', requires: 'users.view' },
  ] },
  { id: 'invoices', label: 'فاکتور و مالیات', items: [
    { key: 'invoices.view', label: 'دیدن مشخصات فاکتور', hint: 'فروشنده و مالیات' },
    { key: 'invoices.edit', label: 'ویرایش فاکتور و مالیات', hint: 'مشخصات فروشنده، روشن/خاموش مالیات', requires: 'invoices.view' },
  ] },
  { id: 'notifications', label: 'اعلان و پیامک', items: [
    { key: 'notifications.manage', label: 'مدیریت پیامک و اعلان‌ها', hint: 'اتصال ملی‌پیامک و الگوها' },
  ] },
  { id: 'settings', label: 'تنظیمات', items: [
    { key: 'settings.view', label: 'دیدن تنظیمات', hint: 'بدون دیدن کلیدها (کلیدها هیچ‌وقت نمایش داده نمی‌شوند)' },
    { key: 'settings.edit', label: 'ویرایش تنظیمات', hint: 'سایت، معرفی دوستان، سطح‌ها، پشتیبانی، درگاه، گوگل، نمادها', requires: 'settings.view' },
    { key: 'audit.view', label: 'دیدن سوابق مدیریتی', hint: 'گزارش تغییرات' },
  ] },
  { id: 'team', label: 'تیم', items: [
    { key: 'team.manage', label: 'مدیریت تیم و دسترسی‌ها', hint: 'افزودن عضو و تعیین دسترسی (فقط تا حد دسترسی خودش)' },
  ] },
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));
const DEFS = new Map(PERMISSION_GROUPS.flatMap(g => g.items).map(i => [i.key, i] as const));
export const isPermissionKey = (v: unknown): v is PermissionKey => typeof v === 'string' && DEFS.has(v as PermissionKey);
export const permissionLabel = (k: string) => DEFS.get(k as PermissionKey)?.label ?? k;

/** Drops unknown keys, adds required "view" keys, de-duplicates, stable order. */
export function normalizePermissions(input: readonly unknown[]): PermissionKey[] {
  const set = new Set<PermissionKey>();
  for (const k of input) if (isPermissionKey(k)) { set.add(k); const r = DEFS.get(k)!.requires; if (r) set.add(r); }
  return ALL_PERMISSIONS.filter(k => set.has(k));
}

export type Preset = { id: string; label: string; hint: string; permissions: PermissionKey[] };
export const PRESETS: Preset[] = [
  { id: 'order-manager', label: 'مدیر سفارش', hint: 'سفارش‌ها را پیگیری و تحویل می‌دهد', permissions: normalizePermissions(['orders.view', 'orders.manage', 'support.view', 'users.view']) },
  { id: 'support-agent', label: 'پشتیبان', hint: 'به تیکت‌ها پاسخ می‌دهد', permissions: normalizePermissions(['support.view', 'support.manage', 'orders.view', 'users.view']) },
  { id: 'accountant', label: 'حسابدار', hint: 'سفارش، فاکتور و بازگشت وجه', permissions: normalizePermissions(['orders.view', 'refunds.process', 'invoices.view', 'invoices.edit', 'users.view']) },
  { id: 'viewer', label: 'ناظر (فقط‌خواندنی)', hint: 'همه‌چیز را می‌بیند، چیزی را تغییر نمی‌دهد', permissions: normalizePermissions(['orders.view', 'support.view', 'catalog.view', 'users.view', 'invoices.view', 'settings.view', 'audit.view']) },
];
export const presetById = (id: string | null | undefined) => PRESETS.find(p => p.id === id) ?? null;

/** The preset a permission set exactly equals, if any. */
export function matchPreset(perms: readonly string[]): Preset | null {
  const s = [...perms].sort().join(',');
  return PRESETS.find(p => [...p.permissions].sort().join(',') === s) ?? null;
}

/** Sidebar / tab sections and the permission that makes each visible. */
export const SECTION_PERMISSION: Record<string, PermissionKey | null> = {
  dashboard: null, orders: 'orders.view', catalog: 'catalog.view', support: 'support.view', users: 'users.view', settings: 'settings.view', audit: 'audit.view', team: 'team.manage',
};
