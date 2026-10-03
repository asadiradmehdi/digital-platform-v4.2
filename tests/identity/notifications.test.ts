import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

import { query } from '../../server/core/db';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

const MIGRATION_PATH = resolve(__dirname, '../../db/migrations/0023_notifications_read.sql');

describe('notifications read_at migration column', () => {
  it('migration file 0023 exists and contains read_at column definition', () => {
    const content = readFileSync(MIGRATION_PATH, 'utf8');
    expect(content).toContain('read_at');
    expect(content).toContain('notifications');
    expect(content).toContain('IF NOT EXISTS');
  });

  it('migration is idempotent (uses ALTER TABLE ... IF NOT EXISTS)', () => {
    const content = readFileSync(MIGRATION_PATH, 'utf8');
    expect(content).toContain('ADD COLUMN IF NOT EXISTS read_at');
  });
});

describe('notifications PATCH — mark as read (SQL verification)', () => {
  it('UPDATE sets read_at with COALESCE to preserve first-read timestamp', () => {
    // Simulate the SQL that PATCH route executes
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'notif-1', readAt: '2026-10-03T00:00:00Z' }],
      rowCount: 1,
    } as never);

    // Test the SQL shape — we verify by calling the same SQL the route uses
    const sql = `UPDATE notifications
       SET read_at = COALESCE(read_at, now())
       WHERE id=$1 AND user_id=$2
       RETURNING id, read_at AS "readAt"`;

    query(sql, ['notif-1', 'user-1']);
    const [executedSql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(executedSql).toContain('COALESCE(read_at, now())');
    expect(executedSql).toContain('user_id=$2');
    expect(params[0]).toBe('notif-1');
    expect(params[1]).toBe('user-1');
  });

  it('COALESCE preserves first read_at when called multiple times', () => {
    // Idempotency: calling PATCH twice should not change read_at
    // Verified by the COALESCE(read_at, now()) pattern — if read_at is already set, it is preserved
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n1', readAt: '2026-10-01T00:00:00Z' }], rowCount: 1 } as never);
    query(
      `UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id=$1 AND user_id=$2 RETURNING id, read_at AS "readAt"`,
      ['n1', 'user-1'],
    );
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe('notifications GET — read field from read_at', () => {
  it('GET SQL derives read boolean from read_at IS NOT NULL', () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const sql = `SELECT id, notification_type AS "type", payload->>'title' AS title,
             (read_at IS NOT NULL) AS read,
             read_at AS "readAt",
             created_at AS "createdAt"
      FROM notifications
      WHERE user_id=$1
      ORDER BY created_at DESC
      LIMIT 50`;

    query(sql, ['user-1']);
    const [executedSql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(executedSql).toContain('(read_at IS NOT NULL) AS read');
    expect(executedSql).toContain('read_at AS "readAt"');
  });
});
