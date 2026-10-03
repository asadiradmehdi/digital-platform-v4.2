import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

import { query } from '../../server/core/db';
import { DbJobQueue } from '../../server/queue/db-queue';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('DbJobQueue — edge cases', () => {
  const q = new DbJobQueue();

  // ── Job retry on failure (attempt count incremented by dequeue) ──────────

  it('dequeue increments attempt count', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'job-2', type: 'order.submit', payload: {}, attempt: 2, available_at: '2026-10-03T00:00:00Z' }],
      rowCount: 1,
    } as never);
    const job = await q.dequeue(['order.submit']);
    expect(job?.attempt).toBe(2);
    // Confirm SQL sets attempt=attempt+1
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('attempt=attempt+1'),
      expect.anything(),
    );
  });

  it('fail sets status to PENDING when under max_attempts (SQL CASE expression)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await q.fail('job-3', 'Transient error');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('CASE WHEN attempt >= max_attempts');
    expect(sql).toContain("'FAILED'");
    expect(sql).toContain("'PENDING'");
    expect(params[0]).toBe('job-3');
    expect(params[1]).toBe('Transient error');
  });

  it('fail SQL uses FAILED status for jobs exceeding max_attempts', async () => {
    // The SQL CASE expression handles this; verify the expression is present
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await q.fail('job-deadletter', 'Max retries reached');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    // The CASE expression in SQL transitions between PENDING and FAILED based on attempt count
    expect(sql).toContain("THEN 'FAILED'");
    expect(sql).toContain("ELSE 'PENDING'");
  });

  // ── Job scheduling with delayMs ──────────────────────────────────────────

  it('enqueue with delayMs sets available_at in the future', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'delayed-job' }], rowCount: 1 } as never);
    const before = Date.now();
    await q.enqueue('order.submit', {}, { delayMs: 5000 });
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    const availableAt = new Date(params[3] as string).getTime();
    expect(availableAt).toBeGreaterThanOrEqual(before + 5000 - 50); // small tolerance
    expect(availableAt).toBeLessThanOrEqual(before + 5000 + 50);
  });

  it('enqueue without delayMs sets available_at to approximately now', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'immediate-job' }], rowCount: 1 } as never);
    const before = Date.now();
    await q.enqueue('order.submit', {});
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    const availableAt = new Date(params[3] as string).getTime();
    expect(availableAt).toBeGreaterThanOrEqual(before - 50);
    expect(availableAt).toBeLessThanOrEqual(before + 500);
  });

  it('enqueue with 0 delayMs sets available_at to now (no delay)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'zero-delay-job' }], rowCount: 1 } as never);
    const before = Date.now();
    await q.enqueue('order.submit', {}, { delayMs: 0 });
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    // delayMs=0 is falsy, so no delay branch taken — falls to else branch (now)
    const availableAt = new Date(params[3] as string).getTime();
    expect(availableAt).toBeGreaterThanOrEqual(before - 50);
    expect(availableAt).toBeLessThanOrEqual(before + 500);
  });

  // ── Concurrent worker safety: FOR UPDATE SKIP LOCKED ─────────────────────

  it('dequeue SQL uses FOR UPDATE SKIP LOCKED to prevent concurrent claim', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await q.dequeue(['order.submit']);
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
  });

  it('dequeue SQL selects only PENDING or FAILED status jobs', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await q.dequeue();
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status IN ('PENDING','FAILED')");
  });

  it('dequeue SQL checks available_at <= now() to respect scheduling', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await q.dequeue();
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('available_at <= now()');
  });

  it('dequeue SQL immediately sets status=PROCESSING via UPDATE', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await q.dequeue();
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status='PROCESSING'");
  });

  // ── Deadletter path: fail truncates long error strings ──────────────────

  it('fail truncates error messages longer than 2000 chars', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const longError = 'x'.repeat(3000);
    await q.fail('job-long', longError);
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect((params[1] as string).length).toBe(2000);
  });

  // ── Dedupe key idempotency ───────────────────────────────────────────────

  it('enqueue with dedupeKey uses ON CONFLICT DO NOTHING', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const id = await q.enqueue('social.publish', {}, { dedupeKey: 'dedup-123' });
    expect(id).toBe('');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT(dedupe_key) DO NOTHING');
    expect(params[2]).toBe('dedup-123');
  });
});
