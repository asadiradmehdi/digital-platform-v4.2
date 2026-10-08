/**
 * Regression (H-1 / C-2): IRT amounts (orders, plans, invoices) were formatted with a helper that
 * assumed rial and divided by 10, so a 1,200,000-toman order showed «۱۲۰٬۰۰۰ تومان». Every amount is
 * now formatted with its own currency, and the currency-blind helper no longer exists.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as format from '../../lib/format';

describe('formatMoney', () => {
  it('shows IRT minor units as toman, unchanged', () => {
    expect(format.formatMoney(1_200_000, 'IRT')).toBe('۱٬۲۰۰٬۰۰۰ تومان');
    expect(format.formatMoney('9900000', 'IRT')).toBe('۹٬۹۰۰٬۰۰۰ تومان');
  });
  it('shows IRR minor units (wallet ledger) as toman, divided by 10', () => {
    expect(format.formatMoney(12_000_000, 'IRR')).toBe('۱٬۲۰۰٬۰۰۰ تومان');
    expect(format.formatMoney(12_000_000n, 'IRR ')).toBe('۱٬۲۰۰٬۰۰۰ تومان');
  });
  it('removed the currency-blind ÷10 helper', () => {
    expect('formatTomanFromIRR' in format).toBe(false);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

describe('no page formats money without its currency', () => {
  it('has no formatTomanFromIRR call sites in app/, components/, lib/ or apps/mobile', () => {
    const roots = ['app', 'components', 'lib', 'apps/mobile/app', 'apps/mobile/src'].map(r => join(process.cwd(), r));
    const offenders = roots.flatMap(r => walk(r)).filter(f => readFileSync(f, 'utf8').includes('formatTomanFromIRR'));
    expect(offenders).toEqual([]);
  });
});
