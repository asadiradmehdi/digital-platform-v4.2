import { describe, expect, it, vi } from 'vitest';
import { onVerifiedGatewayPayment } from '../../server/payments/hooks';
import { REFERRAL_TOPUP_EVENT } from '../../server/referrals/service';

describe('onVerifiedGatewayPayment', () => {
  it('queues the referral reward event on the paying transaction, in rial', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await onVerifiedGatewayPayment({ query } as never, { workspaceId: 'ws-1', paymentId: 'pay-1', amountMinor: 3_500_000n, currency: 'IRR' });
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO outbox_events/);
    expect(params).toEqual(['pay-1', REFERRAL_TOPUP_EVENT, { workspaceId: 'ws-1', paymentId: 'pay-1', amountMinor: '3500000', currency: 'IRR' }]);
  });
});
