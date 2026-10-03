import { AppError } from './errors';
export function parseLimit(value: string | null, fallback = 25, max = 100) {
  const n = value ? Number(value) : fallback;
  if (!Number.isInteger(n) || n < 1 || n > max) throw new AppError('VALIDATION_ERROR', `limit must be an integer between 1 and ${max}.`);
  return n;
}
export function encodeCursor(value: string) { return Buffer.from(value, 'utf8').toString('base64url'); }
export function decodeCursor(value: string | null) { return value ? Buffer.from(value, 'base64url').toString('utf8') : null; }
