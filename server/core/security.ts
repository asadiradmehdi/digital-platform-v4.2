import { AppError } from './errors';

const privateIpv4 = [/^10\./,/^127\./,/^169\.254\./,/^192\.168\./,/^172\.(1[6-9]|2\d|3[0-1])\./,/^0\./,/^100\.64\./];
const blockedHosts = new Set(['localhost','localhost.localdomain','metadata.google.internal','metadata','host.docker.internal']);

function isBlockedIpv6(host:string) {
  const normalized = host.replace(/^\[/,'').replace(/\]$/,'').toLowerCase();
  if (!normalized.includes(':')) return false;
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  return false;
}

export function assertSafeOutboundUrl(raw:string, allowedHosts:string[]=[]){
  let url:URL;
  try { url = new URL(raw); } catch { throw new AppError('VALIDATION_ERROR','Outbound URL is invalid.'); }
  if (url.username || url.password) throw new AppError('FORBIDDEN','Outbound URL credentials are not allowed.');
  if (url.protocol !== 'https:') throw new AppError('FORBIDDEN','Only HTTPS outbound URLs are allowed.');
  const host=url.hostname.toLowerCase();
  if (blockedHosts.has(host) || privateIpv4.some(r=>r.test(host)) || isBlockedIpv6(host)) throw new AppError('FORBIDDEN','Outbound destination is blocked.');
  if (allowedHosts.length && !allowedHosts.some(h=>host===h.toLowerCase() || host.endsWith(`.${h.toLowerCase()}`))) throw new AppError('FORBIDDEN','Outbound destination is not allowlisted.');
  return url;
}

export function redactSecrets(value:unknown):unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  const secretKeys=/token|secret|password|authorization|cookie|api[_-]?key|private[_-]?key/i;
  return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([k,v])=>[k,secretKeys.test(k)?'[REDACTED]':redactSecrets(v)]));
}
