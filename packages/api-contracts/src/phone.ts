// Iranian mobile numbers, shared by the server, the web sign-in form and the mobile app.
// Canonical form is E.164: +989XXXXXXXXX. Accepted input: 09xx…, 9xx…, 989xx…, +989xx…, 00989xx…,
// with Persian (۰-۹) or Arabic-Indic (٠-٩) digits, spaces, dashes, dots and brackets, and stray bidi marks.

const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

/** Converts Persian/Arabic-Indic digits to ASCII, leaving everything else untouched. */
export function toAsciiDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const p = PERSIAN.indexOf(ch);
    if (p >= 0) { out += String(p); continue; }
    const a = ARABIC.indexOf(ch);
    out += a >= 0 ? String(a) : ch;
  }
  return out;
}

/** Returns +989XXXXXXXXX, or null when the input is not an Iranian mobile number. */
export function normalizeIranMobile(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 40) return null;
  // Drop separators and invisible direction marks (LRM/RLM/LRE…/isolates, ZWNJ, NBSP).
  let s = toAsciiDigits(input).replace(/[\s\-.()‌‎‏‪-‮⁦-⁩ ]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  if (!/^\d+$/.test(s)) return null;
  let national: string;
  if (s.startsWith('98') && s.length === 12) national = s.slice(2);
  else if (s.startsWith('09') && s.length === 11) national = s.slice(1);
  else if (s.startsWith('9') && s.length === 10) national = s;
  else return null;
  return /^9\d{9}$/.test(national) ? `+98${national}` : null;
}

/** 09121234567 — the local form SMS panels and Iranian users expect. */
export function toLocalIranMobile(e164: string): string {
  return `0${e164.slice(3)}`;
}

/** «0912 *** 4567» for confirmations; always render inside an LTR span. */
export function maskIranMobile(e164: string): string {
  const local = toLocalIranMobile(e164);
  return `${local.slice(0, 4)} ••• ${local.slice(-4)}`;
}

/** «0912 123 4567» spaced for display (LTR). */
export function formatIranMobile(e164: string): string {
  const l = toLocalIranMobile(e164);
  return `${l.slice(0, 4)} ${l.slice(4, 7)} ${l.slice(7)}`;
}
