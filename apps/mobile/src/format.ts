// Display formatting only (mirrors lib/format.ts on the web). Amounts arrive from the server already in toman.
const fa = new Intl.NumberFormat('fa-IR');
const fa1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

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

/** «۱٬۲۴۸٬۰۰۰» — full toman figure with Persian digits and grouping. */
export function formatTomanNumber(toman: number) {
  return fa.format(Math.round(toman));
}

/** 2000 → { value: «۲», unit: «هزار» }; 999_999 reads «۱ میلیون», never «۱٬۰۰۰ هزار». */
export function magnitudeParts(n: number): { value: string; unit: string } {
  const steps: Array<[number, string]> = [[1e9, 'میلیارد'], [1e6, 'میلیون'], [1e3, 'هزار']];
  for (let i = 0; i < steps.length; i++) {
    const [size, unit] = steps[i];
    const scaled = Math.round((Math.abs(n) / size) * 10) / 10;
    if (scaled >= 1000 && i > 0) return { value: fa1.format(Math.sign(n) * Math.round(Math.abs(n) / steps[i - 1][0] * 10) / 10), unit: steps[i - 1][1] };
    if (scaled >= 1) return { value: fa1.format(Math.sign(n) * scaled), unit };
  }
  return { value: fa.format(n), unit: '' };
}

/** «۲ هزار», «۱ میلیون», «۲۵۰». */
export function formatQuantityWords(n: number) {
  const { value, unit } = magnitudeParts(n);
  return unit ? `${value} ${unit}` : value;
}
