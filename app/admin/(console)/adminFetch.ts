export type AdminResult = { ok: true; data: Record<string, unknown> } | { ok: false; message: string };

/** Same-origin JSON mutation used by every admin form; the browser attaches Origin, which the API checks. */
export async function adminSend(url: string, body: unknown, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST', idempotencyKey?: string): Promise<AdminResult> {
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    const res = await fetch(url, { method, credentials: 'same-origin', headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (res.ok) return { ok: true, data };
    const err = data.error as { message?: string } | undefined;
    return { ok: false, message: (typeof err?.message === 'string' && err.message) || 'انجام نشد. دوباره تلاش کنید.' };
  } catch {
    return { ok: false, message: 'اتصال برقرار نشد. اینترنت را بررسی و دوباره تلاش کنید.' };
  }
}

/** One key per user intent (open sheet → confirm): a double tap or a retry cannot apply the action twice. */
export function newIdempotencyKey(): string {
  try { return crypto.randomUUID(); } catch { return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; }
}
