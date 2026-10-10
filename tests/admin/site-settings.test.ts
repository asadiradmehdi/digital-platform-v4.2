import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/admin/access', () => ({ requirePermission: vi.fn(async () => ({})) }));
const store = new Map<string, unknown>();
vi.mock('../../server/core/platform-settings', () => ({
  getPlatformSetting: vi.fn(async (k: string) => ({ value: store.get(k) ?? null, secret: null, updatedAt: null })),
  setPlatformSetting: vi.fn(async (k: string, i: { value: unknown }) => { store.set(k, i.value); }),
}));
vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withUserTransaction: vi.fn(async (_u: string, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});
import { writeAudit } from '../../server/core/audit';
import { query } from '../../server/core/db';
import { requirePermission } from '../../server/admin/access';
import { AppError } from '../../server/core/errors';
import { assertNotInMaintenance, assertSignupsOpen, getSiteSwitches } from '../../server/core/site-switches';
import { parseReferralTiers, saveLoyalty, saveReferral, saveSite } from '../../server/admin/site-settings';
import { getTierLadder } from '../../server/loyalty/tier-ladder';

const A = '11111111-1111-4111-8111-111111111111';
const q = vi.mocked(query);
beforeEach(() => { vi.clearAllMocks(); store.clear(); });

describe('site switches', () => {
  it('default: signups open, maintenance off', async () => {
    expect(await getSiteSwitches()).toMatchObject({ maintenance: false, signupsOpen: true });
    await expect(assertSignupsOpen()).resolves.toBeUndefined();
    await expect(assertNotInMaintenance()).resolves.toBeUndefined();
  });
  it('saving maintenance/closed signups is enforced by the guards and audited with before/after', async () => {
    await saveSite(A, { maintenance: true, signupsOpen: false, maintenanceMessage: '  به‌زودی  ' });
    await expect(assertNotInMaintenance()).rejects.toMatchObject({ code: 'UNAVAILABLE', message: 'به‌زودی' });
    await expect(assertSignupsOpen()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.settings.site', metadata: expect.objectContaining({ from: expect.objectContaining({ maintenance: false }), to: expect.objectContaining({ maintenance: true }) }) }), expect.anything());
  });
  it('requires settings.edit', async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new AppError('FORBIDDEN', 'no'));
    await expect(saveSite(A, { maintenance: true })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(store.size).toBe(0);
  });
});

describe('referral settings', () => {
  it('tier parser enforces first=0, increasing counts and percent range', () => {
    expect(parseReferralTiers([{ minActive: 0, percent: 3 }, { minActive: 5, percent: 7.5 }])).toEqual([{ minActive: 0, bps: 300 }, { minActive: 5, bps: 750 }]);
    for (const bad of [[], [{ minActive: 1, percent: 3 }], [{ minActive: 0, percent: 3 }, { minActive: 0, percent: 4 }], [{ minActive: 0, percent: 80 }], [{ minActive: 0, percent: 'x' }]]) expect(() => parseReferralTiers(bad as never)).toThrow();
  });
  it('saves toman as rial minor units and audits', async () => {
    q.mockImplementation((async (sql: string) => /SELECT enabled, tiers/.test(sql)
      ? { rows: [{ enabled: true, tiers: [{ minActive: 0, bps: 300 }], welcome_bps: 500, welcome_cap_minor: '500000', hold_days: 7, attribution_months: 12, monthly_cap_minor: '20000000', max_signups_per_ip: 3, budget: '0' }] }
      : { rows: [] }) as never);
    await saveReferral(A, { welcomeCapToman: 70_000, holdDays: 14 });
    const upd = q.mock.calls.find(c => /UPDATE referral_settings/.test(String(c[0])))!;
    const v = upd[1] as unknown[];
    expect(v[3]).toBe('700000'); expect(v[4]).toBe(14); expect(v[6]).toBe('20000000');
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.settings.referral' }), expect.anything());
    await expect(saveReferral(A, { holdDays: 500 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('loyalty settings', () => {
  it('rejects invalid ladders, saves valid ones and getTierLadder reads them back', async () => {
    await expect(saveLoyalty(A, { thresholds: [0, 5, 5, 6, 7] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await saveLoyalty(A, { thresholds: [0, 500_000, 2_000_000, 8_000_000, 20_000_000] });
    expect((await getTierLadder()).map(t => t.minToman)).toEqual([0, 500_000, 2_000_000, 8_000_000, 20_000_000]);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.settings.loyalty' }), expect.anything());
    await saveLoyalty(A, { reset: true });
    expect((await getTierLadder()).map(t => t.minToman)).toEqual([0, 1_000_000, 5_000_000, 10_000_000, 25_000_000]);
  });
});
