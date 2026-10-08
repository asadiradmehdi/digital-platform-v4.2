import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

vi.mock('../../server/core/idempotency', () => ({
  requireIdempotencyKey: vi.fn(),
}));

vi.mock('../../server/core/audit', () => ({
  writeAudit: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { requireIdempotencyKey } from '../../server/core/idempotency';
import { writeAudit } from '../../server/core/audit';
import { createRefund } from '../../server/payments/refund';
import type { PaymentGateway } from '../../server/payments/service';

const mockTx = vi.mocked(withWorkspaceTransaction);
const mockRequireIdem = vi.mocked(requireIdempotencyKey);
const mockWriteAudit = vi.mocked(writeAudit);

beforeEach(() => vi.clearAllMocks());

function buildClient(overrides: {
  existingRefund?: { id: string; status: string } | null;
  payment?: { id: string; status: string; gateway_reference: string; amount_minor: string } | null;
  refundedTotal?: string;
  insertedRefund?: { id: string; status: string };
}) {
  const {
    existingRefund = null,
    payment = { id: 'pay-1', status: 'PAID', gateway_reference: 'gw-ref', amount_minor: '10000' },
    refundedTotal = '0',
    insertedRefund = { id: 'ref-1', status: 'PENDING' },
  } = overrides;

  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM refunds WHERE idempotency_key')) {
        return { rows: existingRefund ? [existingRefund] : [], rowCount: existingRefund ? 1 : 0 };
      }
      if (sql.includes('FROM payments WHERE')) {
        return { rows: payment ? [payment] : [], rowCount: payment ? 1 : 0 };
      }
      if (sql.includes('SUM(amount_minor)')) {
        return { rows: [{ total: refundedTotal }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO refunds')) {
        return { rows: [insertedRefund], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }),
  };
}

const mockRefund = vi.fn().mockResolvedValue({ gatewayReference: 'gw-refund-1', raw: {} });
const mockGateway: PaymentGateway = {
  name: 'mock',
  createCheckout: vi.fn() as PaymentGateway['createCheckout'],
  verify: vi.fn() as PaymentGateway['verify'],
  refund: mockRefund as PaymentGateway['refund'],
};

const baseInput = {
  workspaceId: 'ws-1',
  paymentId: 'pay-1',
  amountMinor: 5000n,
  currency: 'USD',
  idempotencyKey: 'refund-key-abc',
  gateway: mockGateway,
};

describe('createRefund', () => {
  it('returns existing refund on idempotency key match', async () => {
    const existingRefund = { id: 'ref-existing', status: 'PAID' };
    const client = buildClient({ existingRefund });
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    const result = await createRefund(baseInput);
    expect(result).toMatchObject({ id: 'ref-existing', status: 'PAID' });
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('throws VALIDATION_ERROR when amountMinor is zero', async () => {
    await expect(createRefund({ ...baseInput, amountMinor: 0n })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(mockRequireIdem).toHaveBeenCalled();
  });

  it('throws NOT_FOUND when payment does not belong to workspace', async () => {
    const client = buildClient({ payment: null });
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    await expect(createRefund(baseInput)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws CONFLICT when payment is not PAID', async () => {
    const client = buildClient({
      payment: { id: 'pay-1', status: 'PENDING', gateway_reference: '', amount_minor: '10000' },
    });
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    await expect(createRefund(baseInput)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('throws CONFLICT when refund amount exceeds remaining balance', async () => {
    const client = buildClient({ refundedTotal: '8000' });
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    // 8000 already refunded + 5000 > 10000
    await expect(createRefund(baseInput)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('allows refund up to exact remaining balance', async () => {
    const client = buildClient({ refundedTotal: '5000' });
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    // 5000 already refunded + 5000 == 10000 (allowed)
    const result = await createRefund(baseInput);
    expect(result).toMatchObject({ id: 'ref-1' });
  });

  it('calls gateway.refund with payment gateway reference', async () => {
    const client = buildClient({});
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    await createRefund(baseInput);
    expect(mockRefund).toHaveBeenCalledWith(
      expect.objectContaining({ gatewayReference: 'gw-ref', amountMinor: 5000n }),
      'refund-key-abc',
    );
  });

  it('throws UNAVAILABLE when gateway does not support refunds', async () => {
    const client = buildClient({});
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    const noRefundGateway: PaymentGateway = { ...mockGateway, refund: undefined };
    await expect(createRefund({ ...baseInput, gateway: noRefundGateway })).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    });
  });

  it('marks refund FAILED and re-throws when gateway fails', async () => {
    const client = buildClient({});
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    const failingGateway: PaymentGateway = {
      ...mockGateway,
      refund: vi.fn().mockRejectedValue(new Error('Gateway timeout')) as PaymentGateway['refund'],
    };

    await expect(createRefund({ ...baseInput, gateway: failingGateway })).rejects.toThrow(
      'Gateway timeout',
    );
    const calls = client.query.mock.calls;
    const failUpdate = calls.find((call) => (call[0] as string).includes("status='FAILED'"));
    expect(failUpdate).toBeDefined();
  });

  it('calls writeAudit with refund.completed action on success', async () => {
    const client = buildClient({});
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));
    mockWriteAudit.mockResolvedValue(undefined);

    await createRefund(baseInput);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'refund.completed', entityType: 'refund' }),
      expect.objectContaining({ query: expect.any(Function) }), // written on the tenant tx client
    );
  });

  it('returns PAID status with gatewayReference on success', async () => {
    const client = buildClient({});
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => fn(client as never));

    const result = await createRefund(baseInput);
    expect(result).toMatchObject({ id: 'ref-1', status: 'PAID', gatewayReference: 'gw-refund-1' });
  });

  it('validates the idempotency key before any DB access', async () => {
    mockRequireIdem.mockImplementationOnce(() => {
      throw new Error('Key too short');
    });
    await expect(createRefund(baseInput)).rejects.toThrow('Key too short');
    expect(mockTx).not.toHaveBeenCalled();
  });
});
