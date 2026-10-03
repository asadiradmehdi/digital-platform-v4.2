import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(async (_wid: string, _opts: unknown, fn: Function) => fn({ query: vi.fn() })),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { postBalancedTransaction } from '../../server/billing/double-entry';

const mockTx = vi.mocked(withWorkspaceTransaction);
beforeEach(() => vi.clearAllMocks());

describe('postBalancedTransaction', () => {
  it('throws VALIDATION_ERROR when fewer than two lines are given', async () => {
    await expect(
      postBalancedTransaction({
        workspaceId: 'ws-1',
        currency: 'IRR',
        referenceType: 'order',
        idempotencyKey: 'k1',
        lines: [{ accountId: 'acc-1', direction: 'DEBIT', amountMinor: 1000n }],
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws VALIDATION_ERROR when journal is not balanced', async () => {
    await expect(
      postBalancedTransaction({
        workspaceId: 'ws-1',
        currency: 'IRR',
        referenceType: 'order',
        idempotencyKey: 'k2',
        lines: [
          { accountId: 'acc-1', direction: 'DEBIT', amountMinor: 1000n },
          { accountId: 'acc-2', direction: 'CREDIT', amountMinor: 500n },
        ],
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws VALIDATION_ERROR when debit amount is zero', async () => {
    await expect(
      postBalancedTransaction({
        workspaceId: 'ws-1',
        currency: 'IRR',
        referenceType: 'order',
        idempotencyKey: 'k3',
        lines: [
          { accountId: 'acc-1', direction: 'DEBIT', amountMinor: 0n },
          { accountId: 'acc-2', direction: 'CREDIT', amountMinor: 0n },
        ],
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns existing transaction when idempotency key matches', async () => {
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: 'tx-existing' }] });
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    const result = await postBalancedTransaction({
      workspaceId: 'ws-1',
      currency: 'IRR',
      referenceType: 'order',
      idempotencyKey: 'k-dup',
      lines: [
        { accountId: 'acc-1', direction: 'DEBIT', amountMinor: 1000n },
        { accountId: 'acc-2', direction: 'CREDIT', amountMinor: 1000n },
      ],
    });

    expect(result).toEqual({ id: 'tx-existing' });
    // No second INSERT should happen.
    expect(clientQuery).toHaveBeenCalledTimes(1);
  });

  it('creates balanced transaction and inserts all journal lines', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                          // no existing tx
      .mockResolvedValueOnce({ rows: [{ id: 'tx-new' }] })         // INSERT transaction
      .mockResolvedValueOnce({ rows: [] })                          // INSERT line 1
      .mockResolvedValueOnce({ rows: [] });                         // INSERT line 2
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    const result = await postBalancedTransaction({
      workspaceId: 'ws-1',
      currency: 'IRR',
      referenceType: 'order',
      referenceId: 'ord-1',
      idempotencyKey: 'k-new',
      lines: [
        { accountId: 'acc-debit', direction: 'DEBIT', amountMinor: 2000n },
        { accountId: 'acc-credit', direction: 'CREDIT', amountMinor: 2000n },
      ],
    });

    expect(result).toEqual({ id: 'tx-new' });
    // 1 SELECT + 1 INSERT tx + 2 INSERT lines = 4 calls.
    expect(clientQuery).toHaveBeenCalledTimes(4);
  });
});
