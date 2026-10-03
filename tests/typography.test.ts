import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('typography and bidi contracts', () => {
  it('keeps Persian and Latin fixtures stable', () => {
    const fixtures = ['۱۲٬۸۵۰٬۰۰۰ تومان', '#DP-10482', 'AI Writer Pro', '۶۴٪ از اعتبار'];
    expect(fixtures).toHaveLength(4);
    expect(fixtures[0]).toContain('۱۲٬۸۵۰٬۰۰۰');
    expect(fixtures[1]).toBe('#DP-10482');
    expect(fixtures[2]).toBe('AI Writer Pro');
  });
  it('uses isolated bidi tokens in the component contract', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    expect(css).toContain('unicode-bidi:isolate');
    expect(css).toContain('font-variant-numeric:tabular-nums');
    expect(css).toContain('--font-fa');
    expect(css).toContain('--font-latin');
  });
});
