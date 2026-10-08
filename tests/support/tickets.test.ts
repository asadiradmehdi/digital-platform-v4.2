import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withTenantTransaction: vi.fn(), withUserTransaction: vi.fn() }));
vi.mock('../../server/core/distributed-rate-limit', () => ({ consumeDistributedRateLimit: vi.fn() }));

import { withTenantTransaction } from '../../server/core/db';
import { consumeDistributedRateLimit } from '../../server/core/distributed-rate-limit';
import {
  addStaffReply, cleanText, createTicket, listTickets, RATE_LIMITS, validateBody, validateCategory, validateSubject,
} from '../../server/support/tickets';

const WS = '11111111-1111-4111-8111-111111111111';
const TICKET = '22222222-2222-4222-8222-222222222222';
const q = vi.fn();
const sqls = () => q.mock.calls as Array<[string, unknown[]]>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(withTenantTransaction).mockImplementation((async (_w: string, _u: string, fn: (c: unknown) => unknown) => fn({ query: q })) as never);
  q.mockImplementation(async (sql: string) => {
    if (/FOR UPDATE/.test(sql)) return { rows: [{ id: TICKET, status: 'PENDING', code: 'ZT-10002' }], rowCount: 1 };
    if (/INSERT INTO support_tickets/.test(sql)) return { rows: [{ id: TICKET, code: 'ZT-10002' }], rowCount: 1 };
    if (/INSERT INTO support_ticket_messages/.test(sql)) return { rows: [{ id: 'm9', authorKind: 'STAFF', body: 'b', createdAt: 'c' }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
});

describe('support ticket validation', () => {
  it('limits subject to 160 characters and collapses whitespace', () => {
    expect(validateSubject('  سفارش   من\n  ')).toBe('سفارش من');
    expect(validateSubject('ب'.repeat(160))).toHaveLength(160);
    expect(() => validateSubject('ب'.repeat(161))).toThrow(/۱۶۰/);
    expect(() => validateSubject('   ')).toThrow();
    expect(() => validateSubject(42)).toThrow();
  });

  it('requires a body of 2..4000 characters', () => {
    expect(validateBody('سل')).toBe('سل');
    expect(() => validateBody('س')).toThrow();
    expect(validateBody('x'.repeat(4000))).toHaveLength(4000);
    expect(() => validateBody('x'.repeat(4001))).toThrow();
    expect(() => validateBody(null)).toThrow();
  });

  it('strips control and bidi-override characters but keeps line breaks', () => {
    expect(cleanText('a‮b\u0000c\r\nd')).toBe('abc\nd');
    expect(cleanText('a\n\n\n\n\n\nb')).toBe('a\n\n\nb');
  });

  it('accepts only whitelisted categories', () => {
    expect(validateCategory('order')).toBe('ORDER');
    expect(validateCategory(undefined)).toBe('OTHER');
    expect(() => validateCategory('DROP TABLE')).toThrow();
  });
});

describe('support ticket service', () => {
  it('rate-limits creation per user before opening a transaction', async () => {
    await createTicket({ workspaceId: WS, userId: 'u1', subject: 'Help', message: 'please' });
    expect(consumeDistributedRateLimit).toHaveBeenCalledWith({ key: 'u1', ...RATE_LIMITS.create });
    expect(vi.mocked(consumeDistributedRateLimit).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(withTenantTransaction).mock.invocationCallOrder[0]);
  });

  it('never writes the message text into the audit row', async () => {
    await createTicket({ workspaceId: WS, userId: 'u1', subject: 'Help', message: 'my secret details' });
    const audit = sqls().find(([s]) => /audit_logs/.test(s))!;
    expect(JSON.stringify(audit[1])).not.toContain('my secret details');
  });

  it('rejects a malformed order id without a query', async () => {
    await expect(createTicket({ workspaceId: WS, userId: 'u1', subject: 'Help', message: 'please', orderId: "1' OR 1=1" })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(withTenantTransaction).not.toHaveBeenCalled();
  });

  it('lists inside the tenant transaction with a bounded limit', async () => {
    await listTickets(WS, 'u1', { limit: 999 });
    expect(withTenantTransaction).toHaveBeenCalledWith(WS, 'u1', expect.any(Function));
    expect(sqls()[0][1]).toEqual([WS, 50]);
  });

  it('staff reply marks the ticket ANSWERED and unread for the customer', async () => {
    const m = await addStaffReply({ workspaceId: WS, staffUserId: 'staff-1', ticketId: TICKET, body: 'بررسی شد.' });
    expect(m.authorKind).toBe('STAFF');
    expect(sqls().find(([s]) => /INSERT INTO support_ticket_messages/.test(s))![0]).toContain("'STAFF'");
    expect(sqls().find(([s]) => /SET status='ANSWERED'/.test(s))![0]).toContain('has_unread_staff_reply=true');
    expect(sqls().find(([s]) => /audit_logs/.test(s))![1][2]).toBe('support.ticket.staff_reply');
  });
});

describe('support HTTP surface', () => {
  function walk(dir: string, out: string[] = []) {
    for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); }
    return out;
  }
  it('exposes no staff reply endpoint yet', () => {
    const offenders = walk(join(process.cwd(), 'app')).filter(f => /\.(ts|tsx)$/.test(f) && readFileSync(f, 'utf8').includes('addStaffReply'));
    expect(offenders).toEqual([]);
  });
});
