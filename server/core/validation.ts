import { AppError } from './errors';
export function requireString(value: unknown, field: string, min = 1, max = 500): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new AppError('VALIDATION_ERROR', `${field} is invalid.`);
  return value.trim();
}
export function requireUuid(value: unknown, field: string) {
  const s = requireString(value, field, 36, 36);
  // Canonical 8-4-4-4-12 hex form, any version: PostgreSQL `uuid` columns accept it and the catalogue
  // seeds use fixed non-random ids (e.g. 10000000-0000-0000-0000-000000000001).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) throw new AppError('VALIDATION_ERROR', `${field} must be a UUID.`);
  return s;
}
export function safePositiveInteger(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new AppError('VALIDATION_ERROR', `${field} must be a positive integer.`);
  return value as number;
}
