import * as SecureStore from 'expo-secure-store';
import type { ApiError } from '@digital-platform/api-contracts';

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
