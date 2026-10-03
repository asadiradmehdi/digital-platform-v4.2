export type ApiError = { code: string; message: string; correlationId?: string; details?: Record<string, unknown> };
export type Page<T> = { items: T[]; nextCursor?: string | null };
export type WorkspaceSummary = { id: string; name: string; role: string };
export type DashboardSummary = { walletBalanceMinor: number; currency: string; activeOrders: number; activeSubscription?: string; aiUsagePercent: number };
export type ServiceSummary = { id: string; slug: string; name: string; priceMinor: number; currency: string; available: boolean };
export type OrderSummary = { id: string; code: string; status: string; totalMinor: number; currency: string; createdAt: string };
export type AiUsageSummary = { used: number; limit?: number; unit: string; periodStart: string; periodEnd: string };

export const API_VERSION = 'v1' as const;
export const routes = {
  me: `/api/${API_VERSION}/me`,
  workspaces: `/api/${API_VERSION}/workspaces`,
  services: `/api/${API_VERSION}/services`,
  orders: `/api/${API_VERSION}/orders`,
  wallet: `/api/${API_VERSION}/wallet`,
  subscriptions: `/api/${API_VERSION}/subscriptions`,
  notifications: `/api/${API_VERSION}/notifications`,
  analytics: `/api/${API_VERSION}/analytics`,
  security: `/api/${API_VERSION}/security`,
  mobileSession: `/api/${API_VERSION}/auth/mobile/session`,
  mobileLogout: `/api/${API_VERSION}/auth/mobile/logout`,
} as const;

export type MobileSessionResponse = { ok: true; accessToken: string; tokenType: 'Bearer' };

export type SubscriptionSummary = { id:string; plan:string; status:string; renewalDate:string; priceMinor:number; currency:string; usagePercent:number; entitlements:string[] };
export type NotificationSummary = { id:string; type:string; title:string; read:boolean; createdAt:string };
export type TransactionSummary = { id:string; type:string; label:string; amountMinor:number; createdAt:string };
