import { describe, expect, it, vi } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withTenantTransaction: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));

import { query, withTenantTransaction } from '../../server/core/db';
import {
  handleReferralTopup, maskName, normalizeCode, referralCodeFromCookies, shareOf, tierForActive,
} from '../../server/referrals/service';

const tiers = [{ minActive: 0, bps: 300 }, { minActive: 5, bps: 500 }, { minActive: 20, bps: 700 }];

describe('referral tiers and shares', () => {
  it('picks the tier by active friends and names the next one', () => {
    expect(tierForActive(tiers, 0)).toEqual({ current: tiers[0], next: tiers[1] });
    expect(tierForActive(tiers, 5).current.bps).toBe(500);
    expect(tierForActive(tiers, 19).next?.bps).toBe(700);
    expect(tierForActive(tiers, 250)).toEqual({ current: tiers[2], next: null });
  });
  it('rounds shares down to whole rials and never goes negative', () => {
    expect(shareOf(20_000_000n, 300)).toBe(600_000n);
    expect(shareOf(999n, 300)).toBe(29n);
    expect(shareOf(0n, 300)).toBe(0n);
    expect(shareOf(-5n, 300)).toBe(0n);
  });
});

describe('codes and names', () => {
  it('normalises codes and rejects anything else', () => {
    expect(normalizeCode(' qn4nh4 ')).toBe('QN4NH4');
    expect(normalizeCode('AB')).toBeNull();
    expect(normalizeCode("x' OR 1=1")).toBeNull();
    expect(normalizeCode(42)).toBeNull();
  });
  it('reads the invite cookie from a Cookie header', () => {
    expect(referralCodeFromCookies('a=1; zp_ref=qn4nh4; b=2')).toBe('QN4NH4');
    expect(referralCodeFromCookies('zp_ref=<script>')).toBeNull();
    expect(referralCodeFromCookies(null)).toBeNull();
  });
  it('masks a friend to first name and initial', () => {
    expect(maskName('مریم کاظمی')).toBe('مریم ک.');
    expect(maskName('سارا')).toBe('سارا');
    expect(maskName('  ')).toBe('دوست شما');
  });
});

describe('handleReferralTopup', () => {
  it('ignores malformed or non-rial events without touching tenant data', async () => {
    expect(await handleReferralTopup({ workspaceId: 'w', paymentId: 'p', amountMinor: '100', currency: 'IRT' })).toEqual({ skipped: 'bad-payload' });
    expect(await handleReferralTopup({ workspaceId: 'w', paymentId: 'p', amountMinor: 'abc', currency: 'IRR' })).toEqual({ skipped: 'bad-amount' });
    expect(await handleReferralTopup({ workspaceId: '', paymentId: 'p', amountMinor: '100', currency: 'IRR' })).toEqual({ skipped: 'bad-payload' });
    expect(vi.mocked(withTenantTransaction)).not.toHaveBeenCalled();
  });
  it('does nothing while the programme is switched off', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ enabled: false, tiers, welcome_bps: 500, welcome_cap_minor: '500000', hold_days: 7, attribution_months: 12, monthly_cap_minor: '20000000', max_signups_per_ip: 3, programme_monthly_budget_minor: '0' }] } as never);
    expect(await handleReferralTopup({ workspaceId: 'w', paymentId: 'p', amountMinor: '100', currency: 'IRR' })).toEqual({ skipped: 'disabled' });
    expect(vi.mocked(withTenantTransaction)).not.toHaveBeenCalled();
  });
});
