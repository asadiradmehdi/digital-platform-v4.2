// Native-app view endpoints (app/api/v1/app/*). The server owns prices, order stages, loyalty
// level and wording; these types mirror server/account/app-views.ts and the client only renders.
import * as Crypto from 'expo-crypto';
import type { BrandLogo, IconName } from '@digital-platform/design-tokens';
import { apiFetch, ApiClientError } from './client';

export type Tone = 'live' | 'ok' | 'bad';

export type AppCategory = { key: string; name: string; icon: IconName; hint?: string; title?: string; note?: string; live: boolean; count: number };
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

export type AppReferral = {
  code: string; link: string; enabled: boolean;
  sharePercent: number; nextSharePercent: number | null; friendsToNext: number | null; welcomePercent: number;
  invited: number; active: number; earnedToman: number; pendingToman: number;
  friends: Array<{ name: string; joinedAt: string; active: boolean }>;
};
/** Support (mirrors server/support/app-views.ts and server/content/trust.ts). */
export type SupportTone = Tone | 'idle';
export type AppSupportPhone = { label: string; display: string; tel: string };
export type AppSupportCategory = { key: string; label: string; hint: string; icon: IconName };
export type AppTicketCard = {
  id: string; code: string; subject: string; icon: IconName; categoryLabel: string;
  status: { key: string; label: string; tone: SupportTone; note: string };
  preview: string; when: string; unread: boolean; closed: boolean;
};
export type AppTicketMessage = { id: string; mine: boolean; body: string; when: string };
export type AppTicketDetail = AppTicketCard & { order: { id: string; code: string } | null; createdWhen: string; messages: AppTicketMessage[] };
export type AppSupport = { workspaceId: string | null; phones: AppSupportPhone[]; hours: string; categories: AppSupportCategory[]; tickets: AppTicketCard[] };
export type AppLicense = { key: string; title: string; issuer: string; text: string; icon: IconName; status: 'active' | 'pending'; verifyUrl: string | null };
export type AppTrust = { licenses: AppLicense[]; phones: AppSupportPhone[]; hours: string };

const V = '/api/v1';

export const supportApi = {
  overview: () => apiFetch<AppSupport>(`${V}/app/support`),
  ticket: (id: string) => apiFetch<{ workspaceId: string; ticket: AppTicketDetail }>(`${V}/app/support/${encodeURIComponent(id)}`),
  create: (body: { workspaceId: string; category: string; orderId?: string; subject: string; message: string }) =>
    apiFetch<{ ticket: { id: string; code: string } }>(`${V}/support/tickets`, { method: 'POST', body: JSON.stringify(body) }),
  reply: (id: string, body: string) =>
    apiFetch<{ status: string; reopened: boolean }>(`${V}/support/tickets/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  close: (id: string) =>
    apiFetch<{ ticket: { id: string; status: string } }>(`${V}/support/tickets/${encodeURIComponent(id)}/close`, { method: 'POST', body: JSON.stringify({}) }),
  /** Public: licences, support numbers and hours. */
  trust: () => apiFetch<AppTrust>(`${V}/app/trust`),
};

export const SUBJECT_MAX = 160;
export const BODY_MIN = 2;
export const BODY_MAX = 4000;

export const appApi = {
  catalog: () => apiFetch<AppCatalog>(`${V}/app/catalog`),
  overview: () => apiFetch<AppOverview>(`${V}/app/overview`),
  referral: () => apiFetch<AppReferral>(`${V}/app/referral`),
  orders: (workspaceId: string, page: number) =>
    apiFetch<{ items: AppOrderCard[]; page: number; hasMore: boolean }>(`${V}/app/orders?workspaceId=${encodeURIComponent(workspaceId)}&page=${page}`),
  /**
   * Creates the order and pays it: 'wallet' debits the balance in the same request; 'gateway' leaves
   * the order unpaid and returns payment.checkoutUrl — the server marks it paid only after the bank
   * confirms the payment. Team-fulfilled services send a brief; the target is then optional.
   */
  placeOrder: (body: { workspaceId: string; serviceId: string; quantity: number; target: string; brief?: string; paymentMethod: 'wallet' | 'gateway' }, idempotencyKey: string) =>
    apiFetch<{ id: string; status: string; payment?: { method: 'wallet' | 'gateway'; status: string; checkoutUrl?: string } }>(`${V}/orders`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ workspaceId: body.workspaceId, serviceId: body.serviceId, quantity: body.quantity, parameters: body.brief != null ? { ...(body.target ? { target: body.target } : {}), brief: body.brief } : { target: body.target }, paymentMethod: body.paymentMethod }),
    }),
  /**
   * Starts a top-up: the server creates a gateway payment intent and returns the gateway page.
   * The wallet is credited only after the server verifies the payment with the gateway.
   */
  topUp: (body: { workspaceId: string; amountToman: number }, idempotencyKey: string) =>
    apiFetch<{ paymentId: string; checkoutUrl: string }>(`${V}/wallet`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
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
