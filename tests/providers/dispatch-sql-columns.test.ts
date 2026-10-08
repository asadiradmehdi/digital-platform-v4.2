import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Regression: dispatch selected ps.cost_minor, a column provider_services never had, so every paid
// order failed in the outbox before reaching a provider.
describe('provider dispatch SQL', () => {
  it('only reads provider_services columns that the schema defines', () => {
    const schema = readFileSync('db/migrations/0001_initial_schema.sql', 'utf8');
    const table = schema.slice(schema.indexOf('CREATE TABLE provider_services'), schema.indexOf(');', schema.indexOf('CREATE TABLE provider_services')));
    const columns = new Set([...table.matchAll(/^\s+([a-z_]+)\s/gm)].map(m => m[1]));
    const sql = readFileSync('server/providers/dispatch.ts', 'utf8');
    const used = [...sql.matchAll(/\bps\.([a-z_]+)/g)].map(m => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const c of used) expect(columns, `ps.${c}`).toContain(c);
  });
});
