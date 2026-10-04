import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  withWorkspaceTransaction: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { postLedgerEntry } from '../../server/billing/ledger';

const mockTx = vi.mocked(withWorkspaceTransaction);
beforeEach(() => vi.clearAllMocks());

const baseInput = {
  workspaceId: 'ws-1',
  walletId: 'wallet-1',
  accountCode: 'CASH',
  direction: 'CREDIT' as const,
  amountMinor: 5000n,
  currency: 'USD',
  referenceType: 'deposit',
  idempotencyKey: 'idem-abc-123',
};

function buildClient(overrides: {
  accountId?: string | null;
  existingEntryId?: string | null;
  insertedId?: string;
} = {}) {
  const { accountId = 'acct-1', existingEntryId = null, insertedId = 'entry-1' } = overrides;
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM ledger_accounts')) {
        return { rows: accountId ? [{ id: accountId }] : [], rowCount: accountId ? 1 : 0 };
      }
      if (sql.includes('FROM ledger_entries WHERE account_id')) {
        return { rows: existingEntryId ? [{ id: existingEntryId }] : [], rowCount: existingEntryId ? 1 : 0 };
      }
      if (sql.includes('INSERT INTO ledger_entries')) {
        return { rows: [{ id: insertedId }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

describe('postLedgerEntry', () => {
  it('throws VALIDATION_ERROR when amountMinor is zero', async () => {
    await expect(postLedgerEntry({ ...baseInput, amountMinor: 0n })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(mockTx).not.toHaveBeenCalled();
  });

  it('throws VALIDATION_ERROR when amountMinor is negative', async () => {
    await expect(postLedgerEntry({ ...baseInput, amountMinor: -1n })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('throws NOT_FOUND when ledger account does not exist', async () => {
    const client = buildClient({ accountId: null });
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    await expect(postLedgerEntry(baseInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns existing entry on idempotency key match', async () => {
    const client = buildClient({ existingEntryId: 'entry-existing' });
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    const result = await postLedgerEntry(baseInput);
    expect(result).toEqual({ id: 'entry-existing' });
    const insertCalls = client.query.mock.calls.filter(
      (call) => (call[0] as string).includes('INSERT INTO'),
    );
    expect(insertCalls).toHaveLength(0);
  });

  it('inserts a new entry and returns its id', async () => {
    const client = buildClient({});
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    const result = await postLedgerEntry(baseInput);
    expect(result).toEqual({ id: 'entry-1' });
  });

  it('uses FOR UPDATE lock on ledger_accounts for race-safety', async () => {
    const client = buildClient({});
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    await postLedgerEntry(baseInput);
    const accountSql = client.query.mock.calls[0]?.[0] as string;
    expect(accountSql).toContain('FOR UPDATE');
  });

  it('stores direction, amountMinor, currency, referenceType in insert', async () => {
    const client = buildClient({});
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    await postLedgerEntry(baseInput);
    const insertCall = client.query.mock.calls.find(
      (call) => (call[0] as string).includes('INSERT INTO ledger_entries'),
    ) as [string, unknown[]] | undefined;

    expect(insertCall).toBeDefined();
    const params = insertCall![1] as unknown[];
    expect(params).toContain('CREDIT');
    expect(params).toContain(5000n);
    expect(params).toContain('USD');
    expect(params).toContain('deposit');
  });

  it('stores referenceId as null when not provided', async () => {
    const client = buildClient({});
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    await postLedgerEntry({ ...baseInput, referenceId: undefined });
    const insertCall = client.query.mock.calls.find(
      (call) => (call[0] as string).includes('INSERT INTO ledger_entries'),
    ) as [string, unknown[]] | undefined;

    const params = insertCall![1] as unknown[];
    expect(params).toContain(null);
  });

  it('stores empty metadata object when not provided', async () => {
    const client = buildClient({});
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    await postLedgerEntry({ ...baseInput, metadata: undefined });
    const insertCall = client.query.mock.calls.find(
      (call) => (call[0] as string).includes('INSERT INTO ledger_entries'),
    ) as [string, unknown[]] | undefined;

    const params = insertCall![1] as unknown[];
    expect(params).toContainEqual({});
  });
});
