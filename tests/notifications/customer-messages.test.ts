import { describe, expect, it, vi } from 'vitest';
vi.mock('../../server/core/db', () => ({ query: vi.fn(), withTenantTransaction: vi.fn() }));
import { composeMessages, type CustomerEvent } from '../../server/notifications/customer-messages';
import { extractTrackingCode, secretMatches } from '../../server/notifications/sms/inbound';
import { ALWAYS_ON_SMS } from '../../server/notifications/sms/policy';

const ORDER = '4a1c9e00-1111-4111-8111-111111111111';
const ev = (event_type: string, payload: Record<string, unknown> = {}): CustomerEvent => ({ id: 'e', event_type, entity_id: ORDER, attempts: 1, payload: { workspaceId: 'w', orderId: ORDER, ...payload } });
const owner = { userId: 'u', phone: '+989121234567' };

describe('customer messaging policy', () => {
  it('order registered/completed: in-app + SMS pattern with the tracking code and short link code', () => {
    const r = composeMessages(ev('order.registered'), owner);
    expect(r.inbox?.title).toBe('سفارش ZP-4A1C9E ثبت شد');
    expect(r.inbox?.link).toBe(`/orders/${ORDER}`);
    expect(r.sms).toEqual({ template: 'order_registered', args: ['ZP-4A1C9E', '4A1C9E'] });
    expect(composeMessages(ev('order.completed'), owner).sms?.template).toBe('order_completed');
  });

  it('order started / stopped / refunded are in-app only', () => {
    for (const t of ['order.started', 'order.stopped', 'order.refunded']) {
      const r = composeMessages(ev(t), owner);
      expect(r.inbox).not.toBeNull();
      expect(r.sms).toBeNull();
    }
  });

  it('payment receipt: toman amount with Persian digits and the gateway reference', () => {
    const r = composeMessages({ ...ev('payment.paid', { amountMinor: '12480000', currency: 'IRR', purpose: 'TOPUP', reference: 'A1B2', orderId: null }) }, owner);
    expect(r.sms).toEqual({ template: 'payment_receipt', args: ['۱٬۲۴۸٬۰۰۰', 'A1B2'] });
    expect(r.inbox?.title).toBe('شارژ کیف پول ۱٬۲۴۸٬۰۰۰ تومان انجام شد');
    expect(r.inbox?.link).toBe('/wallet');
  });

  it('never queues SMS to an owner without a verified number', () => {
    expect(composeMessages(ev('payment.paid', { amountMinor: '10', currency: 'IRR' }), { userId: 'u', phone: null }).sms).toBeNull();
  });

  it('keeps sign-in codes, receipts and status replies always on', () => {
    expect([...ALWAYS_ON_SMS].sort()).toEqual(['otp', 'payment_receipt', 'status_reply']);
  });
});

describe('inbound status lookup', () => {
  it.each([
    ['ZP-4A1C9E', '4A1C9E'], ['zp 4a1c9e', '4A1C9E'], ['وضعیت سفارش ZP-۴A۱C۹E', '4A1C9E'], ['4a1c9e', '4A1C9E'],
    ['سلام', null], ['ZP-12', null], ['call me 4A1C9E please', null],
  ])('%s → %s', (text, code) => expect(extractTrackingCode(text)).toBe(code));

  it('compares the shared secret safely', () => {
    expect(secretMatches('s'.repeat(30), 's'.repeat(30))).toBe(true);
    expect(secretMatches('s'.repeat(29), 's'.repeat(30))).toBe(false);
    expect(secretMatches(null, 's'.repeat(30))).toBe(false);
  });
});
