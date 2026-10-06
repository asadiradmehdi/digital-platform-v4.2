const fa = new Intl.NumberFormat('fa-IR');

export function formatToman(minor: number | string): string {
  const n = typeof minor === 'string' ? parseInt(minor, 10) : minor;
  if (Number.isNaN(n)) return '—';
  return fa.format(Math.round(n / 10)) + ' تومان';
}

export function formatCount(n: number | string): string {
  const num = typeof n === 'string' ? parseInt(n, 10) : n;
  if (Number.isNaN(num)) return '—';
  return fa.format(num);
}
