import { createHash } from 'node:crypto';
import { AppError } from './errors';
export function requireIdempotencyKey(value: string | null | undefined) { if (!value || value.length < 16 || value.length > 200) throw new AppError('VALIDATION_ERROR','A valid Idempotency-Key is required.'); return value; }
function canonical(value: unknown): unknown { if(Array.isArray(value)) return value.map(canonical); if(value && typeof value==='object') return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])); return value; }
export function requestHash(payload: unknown) { return createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex'); }
