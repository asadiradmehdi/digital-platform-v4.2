// ---------------------------------------------------------------------------
// Core envelope & pagination
// ---------------------------------------------------------------------------
export type ApiError = { code: string; message: string; correlationId?: string; details?: Record<string, unknown> };
export type ApiResponse<T> = T & { correlationId?: string };
export type Page<T> = { items: T[]; nextCursor?: string | null };

// ---------------------------------------------------------------------------
// Route constants
// ---------------------------------------------------------------------------
export const API_VERSION = 'v1' as const;
export const routes = {
  me: `/api/${API_VERSION}/me`,
  workspaces: `/api/${API_VERSION}/workspaces`,
  services: `/api/${API_VERSION}/services`,
  orders: `/api/${API_VERSION}/orders`,
  wallet: `/api/${API_VERSION}/wallet`,
  transactions: `/api/${API_VERSION}/transactions`,
  subscriptions: `/api/${API_VERSION}/subscriptions`,
  notifications: `/api/${API_VERSION}/notifications`,
  analytics: `/api/${API_VERSION}/analytics`,
  invoices: `/api/${API_VERSION}/invoices`,
  checkout: `/api/${API_VERSION}/checkout`,
  health: `/api/${API_VERSION}/health`,
  aiGenerate: `/api/${API_VERSION}/ai/generate`,
  aiModels: `/api/${API_VERSION}/ai/models`,
  aiAgentRuns: `/api/${API_VERSION}/ai/agent-runs`,
  automationWorkflows: `/api/${API_VERSION}/automation/workflows`,
  automationRuns: `/api/${API_VERSION}/automation/runs`,
  b2bApiKeys: `/api/${API_VERSION}/b2b/api-keys`,
  b2bUsage: `/api/${API_VERSION}/b2b/usage`,
  pricingRules: `/api/${API_VERSION}/pricing/rules`,
  pricingFxRates: `/api/${API_VERSION}/pricing/fx-rates`,
  mobileSession: `/api/${API_VERSION}/auth/mobile/session`,
  mobileLogout: `/api/${API_VERSION}/auth/mobile/logout`,
} as const;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export type LoginRequest = { email: string; password: string };
export type LoginResponse = { ok: true };
export type RegisterRequest = { email: string; password: string; name?: string };
export type RegisterResponse = { ok: true; userId: string };
export type MobileSessionResponse = { ok: true; accessToken: string; tokenType: 'Bearer' };

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------
export type UserSummary = { id: string; email: string; name: string; avatarUrl?: string };
export type WorkspaceSummary = { id: string; name: string; role: string };
export type WorkspaceMemberSummary = { userId: string; email: string; role: string; joinedAt: string };

// ---------------------------------------------------------------------------
// Commerce — Services
// ---------------------------------------------------------------------------
export type ServiceSummary = { id: string; slug: string; name: string; priceMinor: number; currency: string; available: boolean };

// ---------------------------------------------------------------------------
// Commerce — Orders
// ---------------------------------------------------------------------------
export type OrderStatus = 'QUEUED' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'REFUNDED';
export type OrderSummary = { id: string; code?: string; status: OrderStatus; totalMinor: number; currency: string; createdAt: string };
export type OrderDetail = OrderSummary & {
  workspaceId: string;
  subtotalMinor: string;
  discountMinor: string;
  events: Array<{ fromStatus: string; toStatus: string; createdAt: string }>;
};
export type CreateOrderRequest = {
  workspaceId: string;
  serviceId: string;
  quantity: number;
  parameters?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Commerce — Checkout
// ---------------------------------------------------------------------------
export type CheckoutItem = { serviceId?: string; planId?: string; quantity: number; parameters?: Record<string, unknown> };
export type CreateCheckoutRequest = {
  workspaceId: string;
  items: CheckoutItem[];
  couponCode?: string;
  idempotencyKey?: string;
  expiresInSeconds?: number;
};
export type CheckoutSession = {
  id: string;
  status: string;
  expiresAt: string;
  lineItems: Array<{ serviceId?: string; planId?: string; quantity: number; unitPriceMinor: number; totalMinor: number; currency: string }>;
  totalMinor: number;
  currency: string;
  discountMinor?: number;
};

// ---------------------------------------------------------------------------
// Wallet & Ledger
// ---------------------------------------------------------------------------
export type WalletSummary = { id: string; currency: string; status: string; balanceMinor: string };
export type WalletDepositRequest = {
  workspaceId: string;
  walletId: string;
  amountMinor: number;
  currency: string;
  referenceType?: string;
  referenceId?: string;
};
export type WalletDepositResponse = { entryId: string; balanceMinor: string; currency: string };
export type LedgerEntry = { accountId: string; direction: 'CREDIT' | 'DEBIT'; amountMinor: number };
export type TransactionSummary = {
  id: string;
  currency: string;
  referenceType: string;
  referenceId: string | null;
  idempotencyKey: string;
  createdAt: string;
  entries: LedgerEntry[];
};
export type DashboardSummary = { walletBalanceMinor: number; currency: string; activeOrders: number; activeSubscription?: string; aiUsagePercent: number };

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
export type SubscriptionSummary = {
  id: string;
  plan: string;
  status: SubscriptionStatus;
  renewalDate: string;
  priceMinor: number;
  currency: string;
  usagePercent: number;
  entitlements: string[];
};
export type CreateSubscriptionRequest = { workspaceId: string; planId: string };
export type CancelSubscriptionRequest = { workspaceId: string; action: 'cancel' };

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type AiGenerateRequest = {
  workspaceId: string;
  model: string;
  messages: AiMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  stream?: boolean;
  idempotencyKey?: string;
};
export type AiGenerateResponse = {
  aiRequestId: string;
  text: string;
  inputUnits: string;
  outputUnits: string;
  providerRequestId?: string;
};
export type AiUsageSummary = { used: number; limit?: number; unit: string; periodStart: string; periodEnd: string };
export type AiModelSummary = { id: string; slug: string; provider: string; contextWindow: number; inputPriceMinorPer1k: number; outputPriceMinorPer1k: number; currency: string };

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export type NotificationSummary = { id: string; type: string; title: string; body?: string | null; link?: string | null; read: boolean; createdAt: string };

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
export type InvoiceSummary = { id: string; number: string; status: string; totalMinor: number; currency: string; issuedAt: string; dueAt?: string };
export type InvoiceDetail = InvoiceSummary & { lineItems: unknown[]; workspaceId: string };

// ---------------------------------------------------------------------------
// B2B
// ---------------------------------------------------------------------------
export type ApiKeySummary = { id: string; name: string; environment: string; scopes: string[]; lastUsedAt?: string; expiresAt?: string };
export type CreateApiKeyRequest = { workspaceId: string; name: string; scopes: string[]; environment?: 'live' | 'test'; expiresAt?: string; rateLimitPerMinute?: number };
export type CreateApiKeyResponse = { key: string };

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export type AnalyticsSummary = { totalOrders: number; completedOrders: number; totalRevenueMinor: number; currency: string; activeUsers: number };

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
export type HealthResponse = { status: 'ok' | 'degraded'; version: string; checks?: Record<string, 'ok' | 'fail'> };

// ---------------------------------------------------------------------------
// Phone sign-in
// ---------------------------------------------------------------------------
export * from './phone';
export type OtpRequestResponse = { ok: true; challengeId: string; expiresIn: number; resendIn: number; maskedPhone: string };
export type OtpVerifyResponse = { ok: true; created: boolean; next: string; mfaRequired?: false } | { ok: true; mfaRequired: true; challengeToken: string };
export type AuthProvidersResponse = { otp: boolean; google: boolean; password: boolean };
