// Regression: the app's screen cache was keyed on fetcher.toString(). In a release (Hermes bytecode) build every function
// stringifies identically, so screens shared one cache entry and rendered each other's data (the app closed on the second visit).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '../../apps/mobile/src');

describe('useRemote cache key', () => {
  it('never derives the key from the fetcher function text', () => {
    const src = readFileSync(join(root, 'hooks/useRemote.ts'), 'utf8');
    expect(src).not.toMatch(/fetcher\.toString\(\)/);
    expect(src).toMatch(/name: string, fetcher/);
  });

  it('every call site passes an explicit name, and inline fetchers get a unique one', () => {
    const dir = join(root, 'screens/zp');
    const calls: string[] = [];
    for (const f of readdirSync(dir).filter(n => n.endsWith('.tsx'))) {
      for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/useRemote\(([^,)]*)/g)) calls.push(`${f}:${m[1].trim()}`);
    }
    expect(calls.length).toBeGreaterThan(20);
    for (const c of calls) expect(c).toMatch(/:'[\w.]+'$/);
    const inline = calls.filter(c => /\.\d+'$/.test(c));
    expect(new Set(inline).size).toBe(inline.length);
  });
});
