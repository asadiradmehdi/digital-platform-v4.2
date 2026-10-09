// Customer-facing Persian wording for plan entitlements. Internal keys never reach the UI.
const fa = (n: number) => n.toLocaleString('fa-IR');

type Limit = { limit?: number | null } | null | undefined;

const LABELS: Record<string, (v: Limit) => string> = {
  orders_per_month: v => (v?.limit == null ? 'سفارش نامحدود' : `${fa(v.limit)} سفارش در ماه`),
  ai_usage: v => (v?.limit == null ? 'هوش مصنوعی نامحدود' : `${fa(v.limit)} درخواست هوش مصنوعی`),
  automation_runs: v => (v?.limit == null ? 'اتوماسیون نامحدود' : `${fa(v.limit)} اجرای اتوماسیون`),
  api_access: () => 'دسترسی API',
  priority_routing: () => 'انجام سفارش با اولویت',
  dedicated_provider: () => 'سرویس‌دهنده‌ی اختصاصی',
  sla: () => 'تضمین کیفیت خدمات',
};

/** Persian label for an entitlement, or null for keys customers should not see. */
export function entitlementLabel(key: string, value: unknown): string | null {
  const make = LABELS[key];
  return make ? make(value as Limit) : null;
}
