/**
 * Unit tests for core utilities:
 * money, validation, pagination, idempotency, audit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The tx helpers hand their callback a client whose query is the shared mockQuery and record the context.
const txContext: Array<{ kind: 'tenant' | 'user'; workspaceId?: string; userId?: string }> = [];
vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return {
    query,
    withTenantTransaction: vi.fn(async (workspaceId: string, userId: string | undefined, fn: (c: { query: typeof query }) => unknown) => { txContext.push({ kind: 'tenant', workspaceId, userId }); return fn({ query }); }),
    withUserTransaction: vi.fn(async (userId: string, fn: (c: { query: typeof query }) => unknown) => { txContext.push({ kind: 'user', userId }); return fn({ query }); }),
  };
});

import { query } from '../../server/core/db';
import { money, addMoney, subtractMoney } from '../../server/core/money';
import { requireString, requireUuid, safePositiveInteger } from '../../server/core/validation';
import { parseLimit, encodeCursor, decodeCursor } from '../../server/core/pagination';
import { requireIdempotencyKey, requestHash } from '../../server/core/idempotency';
import { writeAudit } from '../../server/core/audit';

const mockQuery = vi.mocked(query);

beforeEach(() => vi.clearAllMocks());

// ─── money ────────────────────────────────────────────────────────────────────

describe('money()', () => {
  it('creates a frozen Money value', () => {
    const m = money(1000n, 'IRR');
    expect(m.amountMinor).toBe(1000n);
    expect(m.currency).toBe('IRR');
    expect(Object.isFrozen(m)).toBe(true);
  });

  it('allows zero amount', () => {
    const m = money(0n, 'USD');
    expect(m.amountMinor).toBe(0n);
  });

  it('rejects negative amounts', () => {
    expect(() => money(-1n, 'IRR')).toThrow('cannot be negative');
  });
});

describe('addMoney()', () => {
  it('adds two Money values with the same currency', () => {
    const a = money(300n, 'IRR');
    const b = money(200n, 'IRR');
    expect(addMoney(a, b).amountMinor).toBe(500n);
  });

  it('throws on currency mismatch', () => {
    expect(() => addMoney(money(100n, 'IRR'), money(100n, 'USD'))).toThrow('Currency mismatch');
  });
});

describe('subtractMoney()', () => {
  it('subtracts two Money values with the same currency', () => {
    const a = money(500n, 'USD');
    const b = money(200n, 'USD');
    expect(subtractMoney(a, b).amountMinor).toBe(300n);
  });

  it('throws when result would be negative', () => {
    expect(() => subtractMoney(money(100n, 'IRR'), money(200n, 'IRR'))).toThrow();
  });

  it('throws on currency mismatch', () => {
    expect(() => subtractMoney(money(100n, 'IRR'), money(50n, 'USD'))).toThrow();
  });
});

// ─── validation ──────────────────────────────────────────────────────────────

describe('requireString()', () => {
  it('returns trimmed string when valid', () => {
    expect(requireString('  hello  ', 'field')).toBe('hello');
  });

  it('throws when value is not a string', () => {
    expect(() => requireString(42, 'field')).toThrow('field is invalid');
  });

  it('throws when value is too short', () => {
    expect(() => requireString('ab', 'field', 3)).toThrow('field is invalid');
  });

  it('throws when value is too long', () => {
    expect(() => requireString('x'.repeat(11), 'field', 1, 10)).toThrow('field is invalid');
  });
});

describe('requireUuid()', () => {
  it('accepts the fixed catalogue seed ids (regression: every seeded service failed ordering)', () => {
    expect(requireUuid('10000000-0000-0000-0000-000000000001', 'serviceId')).toBe('10000000-0000-0000-0000-000000000001');
  });
  it('still rejects anything that is not 8-4-4-4-12 hex', () => {
    expect(() => requireUuid('10000000-0000-0000-0000-00000000000g', 'id')).toThrow('must be a UUID');
    expect(() => requireUuid("1000000'-0000-0000-0000-000000000001", 'id')).toThrow('must be a UUID');
  });

  it('accepts a valid UUID v4', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(requireUuid(uuid, 'id')).toBe(uuid);
  });

  it('rejects a string that has UUID length but wrong format', () => {
    // Must be exactly 36 chars to pass the length check, then fail the UUID regex.
    expect(() => requireUuid('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'id')).toThrow('must be a UUID');
  });

  it('rejects a string that is too short', () => {
    expect(() => requireUuid('not-a-uuid', 'id')).toThrow('id is invalid');
  });
});

describe('safePositiveInteger()', () => {
  it('accepts a positive integer', () => {
    expect(safePositiveInteger(5, 'qty')).toBe(5);
  });

  it('rejects zero', () => {
    expect(() => safePositiveInteger(0, 'qty')).toThrow('positive integer');
  });

  it('rejects negative', () => {
    expect(() => safePositiveInteger(-1, 'qty')).toThrow('positive integer');
  });

  it('rejects float', () => {
    expect(() => safePositiveInteger(1.5, 'qty')).toThrow('positive integer');
  });
});

// ─── pagination ───────────────────────────────────────────────────────────────

describe('parseLimit()', () => {
  it('returns the default fallback when value is null', () => {
    expect(parseLimit(null)).toBe(25);
  });

  it('parses a valid integer string', () => {
    expect(parseLimit('50')).toBe(50);
  });

  it('throws when value exceeds max', () => {
    expect(() => parseLimit('200', 25, 100)).toThrow('limit must be');
  });

  it('throws when value is less than 1', () => {
    expect(() => parseLimit('0')).toThrow('limit must be');
  });
});

describe('encodeCursor / decodeCursor', () => {
  it('encodes and decodes a cursor round-trip', () => {
    const original = 'some-cursor-value-123';
    const encoded = encodeCursor(original);
    expect(decodeCursor(encoded)).toBe(original);
  });

  it('decodeCursor returns null for null input', () => {
    expect(decodeCursor(null)).toBeNull();
  });
});

// ─── idempotency ─────────────────────────────────────────────────────────────

describe('requireIdempotencyKey()', () => {
  it('accepts a valid key (16+ chars)', () => {
    const key = 'a'.repeat(16);
    expect(requireIdempotencyKey(key)).toBe(key);
  });

  it('rejects null', () => {
    expect(() => requireIdempotencyKey(null)).toThrow('Idempotency-Key');
  });

  it('rejects keys shorter than 16 chars', () => {
    expect(() => requireIdempotencyKey('short')).toThrow('Idempotency-Key');
  });

  it('rejects keys longer than 200 chars', () => {
    expect(() => requireIdempotencyKey('x'.repeat(201))).toThrow('Idempotency-Key');
  });
});

describe('requestHash()', () => {
  it('returns a hex sha256 string', () => {
    const hash = requestHash({ foo: 'bar' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic regardless of key order', () => {
    const h1 = requestHash({ b: 2, a: 1 });
    const h2 = requestHash({ a: 1, b: 2 });
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different inputs', () => {
    expect(requestHash({ a: 1 })).not.toBe(requestHash({ a: 2 }));
  });
});

// ─── audit ────────────────────────────────────────────────────────────────────

describe('writeAudit()', () => {
  beforeEach(() => { txContext.length = 0; });

  it('writes a workspace row inside that workspace\'s RLS context', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await writeAudit({
      workspaceId: 'ws-1',
      actorUserId: 'user-1',
      action: 'UPDATE',
      entityType: 'subscription',
      entityId: 'sub-1',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      metadata: { reason: 'test' },
    });
    expect(txContext).toEqual([{ kind: 'tenant', workspaceId: 'ws-1', userId: 'user-1' }]);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.arrayContaining(['ws-1', 'user-1', 'UPDATE', 'subscription'])
    );
  });

  it('writes an account-level row (no workspace) in the actor\'s user context', async () => {
    // Regression: these rows were written with no context, which audit_logs RLS rejects in production.
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await writeAudit({ actorUserId: 'user-1', action: 'LOGOUT', entityType: 'session' });
    expect(txContext).toEqual([{ kind: 'user', userId: 'user-1' }]);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.arrayContaining([null, 'user-1', 'LOGOUT', 'session'])
    );
  });

  it('uses the caller\'s transaction client when one is passed', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await writeAudit({ workspaceId: 'ws-1', action: 'order.created', entityType: 'order' }, client as never);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit_logs'), expect.arrayContaining(['ws-1', null, 'order.created']));
    expect(txContext).toEqual([]);
  });

  it('refuses a row with neither workspace nor actor, which no policy could accept', async () => {
    await expect(writeAudit({ action: 'READ', entityType: 'workspace' })).rejects.toThrow(/workspaceId or an actorUserId/);
  });

  it('propagates DB errors', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error') as never);
    await expect(writeAudit({ actorUserId: 'u', action: 'DELETE', entityType: 'user' })).rejects.toThrow('DB error');
  });
});
