/**
 * Regression tests for wallet deposit (POST /api/v1/wallet) route logic
 * and postLedgerEntry idempotency contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { postLedgerEntry } from '../../server/billing/ledger';

const mockTx = vi.mocked(withWorkspaceTransaction);
beforeEach(() => vi.clearAllMocks());

const baseInput = {
  workspaceId: 'ws-1',
  walletId: 'wal-1',
  accountCode: 'MAIN',
  direction: 'CREDIT' as const,
  amountMinor: 1000000n,
  currency: 'IRR',
  referenceType: 'DEPOSIT',
  idempotencyKey: 'dep-key-1',
};

describe('postLedgerEntry', () => {
  it('throws VALIDATION_ERROR when amountMinor is zero', async () => {
    await expect(
      postLedgerEntry({ ...baseInput, amountMinor: 0n })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws VALIDATION_ERROR when amountMinor is negative', async () => {
    await expect(
      postLedgerEntry({ ...baseInput, amountMinor: -500n })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns existing entry on duplicate idempotency key', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] })   // SELECT ledger_account FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 'le-existing' }] });  // duplicate idempotency check

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    const result = await postLedgerEntry(baseInput);
    expect(result).toMatchObject({ id: 'le-existing' });
    // Should not insert a new entry
    expect(clientQuery).toHaveBeenCalledTimes(2);
  });

  it('inserts a new ledger entry when no duplicate', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] })   // ledger_account
      .mockResolvedValueOnce({ rows: [] })                   // no duplicate
      .mockResolvedValueOnce({ rows: [{ id: 'le-new' }] }); // insert

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    const result = await postLedgerEntry(baseInput);
    expect(result).toMatchObject({ id: 'le-new' });
    expect(clientQuery).toHaveBeenCalledTimes(3);
  });

  it('throws NOT_FOUND when ledger account does not exist', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] }); // no ledger account

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await expect(postLedgerEntry(baseInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
