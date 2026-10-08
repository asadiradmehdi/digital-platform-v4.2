// Short-lived, read-only view links for one invoice, so the native app can open the printable web
// invoice («اشتراک‌گذاری / ذخیره PDF») in the system browser, which has no session cookie.
//
// The link is issued only by the authenticated app API (wallet.read in the invoice's workspace) and
// grants nothing but rendering that single document until it expires. It is an HMAC over
// (invoice id, workspace id, expiry) with a key derived from SECRETS_MASTER_KEY; without that secret no
// links are issued or accepted. The page that accepts it sends no Referer to other origins and is not
// indexed.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const INVOICE_LINK_TTL_SECONDS = 30 * 60;

function key(): Buffer | null {
  const raw = process.env.SECRETS_MASTER_KEY;
  if (!raw) return null;
  return createHash('sha256').update(`invoice-view-link:v1:${raw}`).digest();
}

function sign(k: Buffer, invoiceId: string, workspaceId: string, exp: number) {
  return createHmac('sha256', k).update(`${invoiceId}.${workspaceId}.${exp}`).digest('base64url');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<workspaceId>.<exp>.<sig>`, or null when links are not configured. */
export function signInvoiceViewToken(invoiceId: string, workspaceId: string, now = Date.now(), ttlSeconds = INVOICE_LINK_TTL_SECONDS): string | null {
  const k = key();
  if (!k || !UUID.test(invoiceId) || !UUID.test(workspaceId)) return null;
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return `${workspaceId}.${exp}.${sign(k, invoiceId, workspaceId, exp)}`;
}

/** The workspace the token was issued for, when it is authentic, unexpired and for this invoice. */
export function verifyInvoiceViewToken(invoiceId: string, token: string | null | undefined, now = Date.now()): { workspaceId: string } | null {
  const k = key();
  if (!k || !token || token.length > 200 || !UUID.test(invoiceId)) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [workspaceId, expRaw, sig] = parts;
  if (!UUID.test(workspaceId) || !/^\d{1,12}$/.test(expRaw)) return null;
  const exp = Number(expRaw);
  if (exp < Math.floor(now / 1000)) return null;
  const expected = Buffer.from(sign(k, invoiceId, workspaceId, exp));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return { workspaceId };
}
