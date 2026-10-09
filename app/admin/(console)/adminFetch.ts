/** Same-origin JSON mutation used by every admin form; the browser attaches Origin, which the API checks. */
export async function adminSend(url: string, body: unknown, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (res.ok) return { ok: true, data };
    const err = data.error as { message?: string } | undefined;
    return { ok: false, message: (typeof err?.message === 'string' && err.message) || 'انجام نشد. دوباره تلاش کنید.' };
  } catch {
    return { ok: false, message: 'اتصال برقرار نشد. اینترنت را بررسی و دوباره تلاش کنید.' };
  }
}
