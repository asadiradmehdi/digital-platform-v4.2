import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Regression: markOutboxFailed set updated_at, which outbox_events doesn't have, so one failing
// event aborted the whole batch (and every event behind it) instead of being retried.
describe('markOutboxFailed', () => {
  it('only writes columns outbox_events has', () => {
    const schema = readFileSync('db/migrations/0001_initial_schema.sql', 'utf8');
    const start = schema.indexOf('CREATE TABLE outbox_events');
    const columns = new Set([...schema.slice(start, schema.indexOf(');', start)).matchAll(/^\s+([a-z_]+)\s/gm)].map(m => m[1]));
    const src = readFileSync('server/queue/outbox-dispatch.ts', 'utf8');
    const update = src.match(/markOutboxFailed[^`]*`UPDATE outbox_events SET ([^`]*?) WHERE/)?.[1] ?? '';
    const set = [...update.matchAll(/([a-z_]+)\s*=/g)].map(m => m[1]);
    expect(set).toContain('attempts');
    for (const c of set) expect(columns, c).toContain(c);
  });
});
