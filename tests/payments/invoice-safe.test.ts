// Regression: a failure while writing the invoice document must not roll back the payment that
// issued it (a captured gateway payment would otherwise be lost and every re-verify would fail again).
import { describe, expect, it, vi } from 'vitest';
import { issueTopupReceipt } from '../../server/payments/invoice';

function client(failOn: RegExp) {
  const sql: string[] = [];
  return {
    sql,
    query: vi.fn(async (text: string) => {
      sql.push(text.trim().split(/\s+/).slice(0, 4).join(' '));
      if (failOn.test(text)) throw new Error('boom');
      if (/app_next_invoice_number/.test(text)) return { rows: [{ n: 'ZP-1405-000001' }] };
      if (/INSERT INTO invoices/.test(text)) return { rows: [{ id: 'inv-1' }] };
      return { rows: [] };
    }),
  };
}

const input = { workspaceId: 'ws-1', paymentId: '00000000-0000-0000-0000-000000000001', amountMinor: 5_000_000n, currency: 'IRR', reference: 'ref', reason: 'TOPUP' };

describe('invoice issuing never fails the payment', () => {
  it('rolls back only to its savepoint and returns null when the document cannot be written', async () => {
    const c = client(/INSERT INTO invoices/);
    await expect(issueTopupReceipt(c as never, input)).resolves.toBeNull();
    expect(c.sql[0]).toBe('SAVEPOINT invoice_issue');
    expect(c.sql).toContain('ROLLBACK TO SAVEPOINT invoice_issue');
    expect(c.sql).not.toContain('RELEASE SAVEPOINT invoice_issue');
  });

  it('releases the savepoint and returns the document when it is written', async () => {
    const c = client(/^$/);
    const r = await issueTopupReceipt(c as never, input);
    expect(r).toMatchObject({ id: 'inv-1', created: true });
    expect(c.sql).toContain('RELEASE SAVEPOINT invoice_issue');
    expect(c.sql).not.toContain('ROLLBACK TO SAVEPOINT invoice_issue');
  });
});
