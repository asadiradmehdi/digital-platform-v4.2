import type { AppError } from './errors';
export type UUID = string;
export type ISODate = string;
export type Currency = 'IRR' | 'USD' | 'EUR' | (string & {});

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};
