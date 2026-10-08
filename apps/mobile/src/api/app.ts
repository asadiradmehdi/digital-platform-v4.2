// Native-app view endpoints (app/api/v1/app/*). The server owns prices, order stages, loyalty
// level and wording; these types mirror server/account/app-views.ts and the client only renders.
import * as Crypto from 'expo-crypto';
import type { BrandLogo, IconName } from '@digital-platform/design-tokens';
import { apiFetch, ApiClientError } from './client';

export type Tone = 'live' | 'ok' | 'bad';

export type AppCategory = { key: string; name: string; icon: IconName; title?: string; note?: string; live: boolean; count: number };
export type AppService = {
  id: string; slug: string; name: string; description: string | null; category: string;
  /** Name inside its category («سیو» on the Instagram page); `brand` is set for AI plans. */
  short: string; brand: BrandLogo | null; perLabel: string;
  group: string; unit: string; icon: IconName; per: number; unitPriceToman: number; quantities: number[];
  /** `required` is false for optional targets (design / AI content: page or site is a hint). */
  target: { label: string; placeholder: string; ltr: boolean; required?: boolean };
  /** Team-fulfilled services (design, automation, AI content) ask for a written brief. */
  brief?: { label: string; placeholder: string; min: number; max: number } | null;
  /** Delivery terms shown above the packages (delivery days, revisions, no auto-renewal, refund). */
  facts?: Array<{ icon: IconName; text: string }>;
  refund?: string;
};
export type AppCatalog = { categories: AppCategory[]; services: AppService[] };

export type AppOrderCard = {
  id: string; code: string; title: string; subtitle: string; icon: IconName;
  stage: { label: string; steps: number; tone: Tone }; amountToman: number;
};
export type AppWalletEntry = { id: string; title: string; when: string; amountToman: number; credit: boolean; icon: IconName };
export type AppOverview = {
  viewer: { displayName: string; contact: string };
  workspaceId: string | null;
  wallet: { walletId: string; currency: string; balanceToman: number; entries: AppWalletEntry[] } | null;
  activeOrders: AppOrderCard[];
  stats: { totalOrders: number; activeOrders: number; spentToman: number };
  tier: { name: string; level: number; levels: number; next: string | null; progress: number };
  mfa: boolean;
};

const V = '/api/v1';

export const appApi = {
  catalog: () => apiFetch<AppCatalog>(`${V}/app/catalog`),
  overview: () => apiFetch<AppOverview>(`${V}/app/overview`),
  orders: (workspaceId: string, page: number) =>
    apiFetch<{ items: AppOrderCard[]; page: number; hasMore: boolean }>(`${V}/app/orders?workspaceId=${encodeURIComponent(workspaceId)}&page=${page}`),
  /** Creates the order and pays it from the wallet in one server transaction flow. */
  placeOrder: (body: { workspaceId: string; serviceId: string; quantity: number; target: string; brief?: string }, idempotencyKey: string) =>
    apiFetch<{ id: string; status: string }>(`${V}/orders`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ workspaceId: body.workspaceId, serviceId: body.serviceId, quantity: body.quantity, parameters: body.brief != null ? { ...(body.target ? { target: body.target } : {}), brief: body.brief } : { target: body.target } }),
    }),
  topUp: (body: { workspaceId: string; walletId: string; amountMinor: number; currency: string }, idempotencyKey: string) =>
    apiFetch<{ entryId: string }>(`${V}/wallet`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ ...body, referenceType: 'TOPUP' }),
    }),
};

export const newIdempotencyKey = () => Crypto.randomUUID();

/** Public website pages (terms, about) open in the browser. */
export const siteUrl = (path: string) => `${process.env.EXPO_PUBLIC_API_BASE_URL ?? ''}${path}`;

const BY_STATUS: Record<number, string> = {
  0: 'اتصال به سرور برقرار نشد. اینترنت را بررسی کنید.',
  400: 'اطلاعات واردشده معتبر نیست. دوباره بررسی کنید.',
  401: 'نشست شما تمام شده است. دوباره وارد شوید.',
  402: 'موجودی کیف پول کافی نیست.',
  403: 'اجازه‌ی انجام این کار را ندارید.',
  404: 'مورد درخواستی پیدا نشد.',
  409: 'این درخواست با وضعیت فعلی سازگار نیست. دوباره تلاش کنید.',
  429: 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.',
};

/** Customer-facing Persian sentence for an API failure; English developer messages never reach the UI. */
export function errorText(e: unknown, fallback: string) {
  if (e instanceof ApiClientError) {
    if (/[؀-ۿ]/.test(e.message)) return e.message;
    return BY_STATUS[e.status] ?? fallback;
  }
  if (e instanceof TypeError) return BY_STATUS[0];
  return fallback;
}
