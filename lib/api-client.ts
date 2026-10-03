import type { ApiError, Page, ServiceSummary, OrderSummary, WorkspaceSummary, DashboardSummary } from '@digital-platform/api-contracts';

export type ApiResult<T> = { ok:true; data:T; correlationId?:string } | { ok:false; error:ApiError };
export async function api<T>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(input, { ...init, headers:{ Accept:'application/json', ...(init?.body ? {'Content-Type':'application/json'} : {}), ...(init?.headers ?? {}) }, credentials:'include' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { ok:false, error: payload?.error ?? { code:`HTTP_${response.status}`, message:'درخواست انجام نشد.' } };
    return { ok:true, data: payload as T, correlationId: response.headers.get('x-correlation-id') ?? undefined };
  } catch { return { ok:false, error:{ code:'NETWORK_ERROR', message:'ارتباط با سرویس برقرار نشد.' } }; }
}
export type CoreSnapshot = { dashboard:DashboardSummary; services:Page<ServiceSummary>; orders:Page<OrderSummary>; workspaces:WorkspaceSummary[] };
