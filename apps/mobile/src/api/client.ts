import * as SecureStore from 'expo-secure-store';
import type {
  ApiError,
  MobileSessionResponse,
  WorkspaceSummary,
  OrderSummary,
  SubscriptionSummary,
  NotificationSummary,
  TransactionSummary,
  AiUsageSummary,
  Page,
} from '@digital-platform/api-contracts';

// Re-export for convenience
export type { MobileSessionResponse, WorkspaceSummary, OrderSummary, SubscriptionSummary, NotificationSummary, TransactionSummary, AiUsageSummary, Page };

const TOKEN_KEY = 'dp.mobile.session.v1';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export async function getAccessToken() { return SecureStore.getItemAsync(TOKEN_KEY); }
export async function setAccessToken(token: string) { return SecureStore.setItemAsync(TOKEN_KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); }
export async function clearAccessToken() { return SecureStore.deleteItemAsync(TOKEN_KEY); }

export class ApiClientError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly correlationId?: string) { super(message); }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiClientError(0, 'MOBILE_API_BASE_URL_MISSING', 'EXPO_PUBLIC_API_BASE_URL تنظیم نشده است.');
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const correlationId = response.headers.get('x-correlation-id') ?? undefined;
  const payload = await response.json().catch(() => null) as (T & { error?: ApiError }) | null;
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiClientError(response.status, error?.code ?? 'HTTP_ERROR', error?.message ?? 'خطا در ارتباط با سرویس.', correlationId);
  }
  return payload as T;
}

// ---------------------------------------------------------------------------
// Typed API methods — mirror server contract; keep in sync with app/api/v1/*
// ---------------------------------------------------------------------------

const V1 = '/api/v1';

// Auth
export const auth = {
  mobileLogin: (body: { sessionToken: string }) =>
    apiFetch<MobileSessionResponse>(`${V1}/auth/mobile/session`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  mobileLogout: () =>
    apiFetch<{ ok: true }>(`${V1}/auth/mobile/logout`, { method: 'POST' }),
};

// Me
export const me = {
  get: () => apiFetch<{ user: { id: string; email: string | null; phone: string | null; displayName: string | null; phoneVerified: boolean; emailVerified: boolean } }>(`${V1}/me`),
};

// Notification preferences (channel × category switches; `locked` pairs are never switchable)
export const notificationPrefs = {
  get: () => apiFetch<{ preferences: { channel: string; category: string; enabled: boolean }[]; locked: string[] }>(`${V1}/notifications/preferences`),
  save: (preferences: { channel: string; category: string; enabled: boolean }[]) =>
    apiFetch<{ ok: true }>(`${V1}/notifications/preferences`, { method: 'PUT', body: JSON.stringify({ preferences }) }),
};

// Public plan catalogue
export const plans = {
  list: () => apiFetch<{ items: { id: string; name: string; slug: string; price_minor: string; currency: string; billing_interval: string; description: string | null; entitlements: { entitlement_key: string; value: unknown }[] }[] }>(`${V1}/plans`),
};

// Workspaces
export const workspaces = {
  list: () => apiFetch<{ items: WorkspaceSummary[] }>(`${V1}/workspaces`),
  create: (body: { name: string }) =>
    apiFetch<{ id: string; name: string }>(`${V1}/workspaces`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listMembers: (workspaceId: string) =>
    apiFetch<{ items: { userId: string; email: string; role: string }[] }>(`${V1}/workspaces/${workspaceId}/members`),
};

// Wallet
export const wallet = {
  getBalances: () => apiFetch<{ items: { id: string; currency: string; status: string; balanceMinor: string }[] }>(`${V1}/wallet`),
  deposit: (body: { workspaceId: string; walletId: string; amountMinor: number; currency: string; referenceType?: string; referenceId?: string }, idempotencyKey?: string) =>
    apiFetch<{ entryId: string; balanceMinor: string; currency: string }>(`${V1}/wallet`, {
      method: 'POST',
      headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
      body: JSON.stringify(body),
    }),
};

// Transactions
export const transactions = {
  list: (workspaceId: string, cursor?: string) =>
    apiFetch<{ items: TransactionSummary[]; nextCursor?: string | null }>(`${V1}/transactions?workspaceId=${encodeURIComponent(workspaceId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),
};

// Orders
export const orders = {
  list: (workspaceId: string) =>
    apiFetch<{ items: OrderSummary[]; nextCursor?: string | null }>(`${V1}/orders?workspaceId=${encodeURIComponent(workspaceId)}`),
  get: (orderId: string, workspaceId: string) =>
    apiFetch<{ order: OrderSummary; events: unknown[] }>(`${V1}/orders/${encodeURIComponent(orderId)}?workspaceId=${encodeURIComponent(workspaceId)}`),
  create: (body: { workspaceId: string; serviceId: string; quantity: number; parameters?: Record<string, unknown> }, idempotencyKey?: string) =>
    apiFetch<{ id: string; status: string }>(`${V1}/orders`, {
      method: 'POST',
      headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
      body: JSON.stringify(body),
    }),
  /** The server requires an Idempotency-Key: a retried cancel must never refund twice. */
  cancel: (orderId: string, body: { workspaceId: string }, idempotencyKey: string) =>
    apiFetch<{ id: string; status: string }>(`${V1}/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      headers: { 'idempotency-key': idempotencyKey },
      body: JSON.stringify(body),
    }),
};

// Subscriptions
export const subscriptions = {
  list: () => apiFetch<{ items: SubscriptionSummary[]; nextCursor: null }>(`${V1}/subscriptions`),
  create: (body: { workspaceId: string; planId: string }, idempotencyKey?: string) =>
    apiFetch<{ id: string; status: string }>(`${V1}/subscriptions`, {
      method: 'POST',
      headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
      body: JSON.stringify(body),
    }),
  cancel: (subscriptionId: string, body: { workspaceId: string }) =>
    apiFetch<{ id: string; status: string }>(`${V1}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...body, action: 'cancel' }),
    }),
};

// Notifications
export const notifications = {
  list: () => apiFetch<{ items: NotificationSummary[] }>(`${V1}/notifications`),
};

// AI
export const ai = {
  generate: (body: {
    workspaceId: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxOutputTokens?: number;
    idempotencyKey?: string;
  }) =>
    apiFetch<{ aiRequestId: string; text: string; inputUnits: string; outputUnits: string }>(`${V1}/ai/generate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listModels: (workspaceId: string) =>
    apiFetch<{ models: unknown[] }>(`${V1}/ai/models?workspaceId=${encodeURIComponent(workspaceId)}`),
  listAgentRuns: (workspaceId: string) =>
    apiFetch<{ items: unknown[] }>(`${V1}/ai/agent-runs?workspaceId=${encodeURIComponent(workspaceId)}`),
  startAgentRun: (body: { workspaceId: string; agentDefinitionId: string; input?: Record<string, unknown> }) =>
    apiFetch<{ runId: string }>(`${V1}/ai/agent-runs`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// Automation
export const automation = {
  listWorkflows: (workspaceId: string) =>
    apiFetch<{ items: unknown[] }>(`${V1}/automation/workflows?workspaceId=${encodeURIComponent(workspaceId)}`),
  createWorkflow: (body: { workspaceId: string; name: string; definition: Record<string, unknown>; runNow?: boolean }) =>
    apiFetch<{ workflowId: string; versionId: string; runId?: string }>(`${V1}/automation/workflows`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listRuns: (workspaceId: string, workflowId?: string) =>
    apiFetch<{ items: unknown[] }>(`${V1}/automation/runs?workspaceId=${encodeURIComponent(workspaceId)}${workflowId ? `&workflowId=${encodeURIComponent(workflowId)}` : ''}`),
};

// Invoices
export const invoices = {
  list: (workspaceId: string) =>
    apiFetch<{ items: unknown[] }>(`${V1}/invoices?workspaceId=${encodeURIComponent(workspaceId)}`),
  get: (invoiceId: string) =>
    apiFetch<{ invoice: unknown }>(`${V1}/invoices/${encodeURIComponent(invoiceId)}`),
};

// Analytics
export const analytics = {
  get: (workspaceId: string) =>
    apiFetch<{ summary: unknown }>(`${V1}/analytics?workspaceId=${encodeURIComponent(workspaceId)}`),
};

// Support tickets
export const support = {
  listTickets: (workspaceId: string) =>
    apiFetch<{ items: { id: string; subject: string; status: string; priority: string; createdAt: string }[] }>(
      `${V1}/support/tickets?workspaceId=${encodeURIComponent(workspaceId)}`,
    ),
  createTicket: (body: { workspaceId: string; subject: string; category?: string; priority?: string; message?: string }) =>
    apiFetch<{ ticket: { id: string } }>(`${V1}/support/tickets`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// Sessions (security center)
export const sessions = {
  list: () =>
    apiFetch<{ items: { id: string; clientType: string; deviceName: string; lastSeenAt: string; createdAt: string; current: boolean }[] }>(
      `${V1}/auth/sessions`,
    ),
  revoke: (id: string) =>
    apiFetch<{ ok: true }>(`${V1}/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  revokeOthers: () =>
    apiFetch<{ ok: true }>(`${V1}/auth/sessions`, { method: 'DELETE' }),
};

// Audit events
export const auditEvents = {
  list: () =>
    apiFetch<{ items: { id: string; action: string; entityType: string; createdAt: string }[] }>(
      `${V1}/me/audit-events`,
    ),
};

// Health
export const health = {
  get: () => apiFetch<{ status: string; version: string }>(`${V1}/health`),
};
