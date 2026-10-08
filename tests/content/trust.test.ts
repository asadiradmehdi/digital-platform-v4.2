import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withUserTransaction: vi.fn(), withTenantTransaction: vi.fn() }));

import { query, withUserTransaction } from '../../server/core/db';
import { formatSupportPhone, getSupportContact, setSupportHours, supportPhones, upsertSupportContact } from '../../server/content/trust';

const mockQuery = vi.mocked(query);
function db(contacts: Array<{ label: string; phone: string }>, hours: string | null) {
  mockQuery.mockImplementation((async (sql: string) => /support_contacts/.test(sql)
    ? { rows: contacts, rowCount: contacts.length }
    : { rows: hours == null ? [] : [{ hours }], rowCount: hours == null ? 0 : 1 }) as never);
}

beforeEach(() => { vi.resetAllMocks(); });

describe('support phone formatting', () => {
  it('formats Iranian mobile and landline numbers as dialable E.164 + Persian display', () => {
    expect(formatSupportPhone('فروش', '09121234567')).toEqual({ label: 'فروش', display: '۰۹۱۲ ۱۲۳ ۴۵۶۷', tel: '+989121234567' });
    expect(formatSupportPhone('دفتر', '+982112345678')).toEqual({ label: 'دفتر', display: '۰۲۱ ۱۲۳۴ ۵۶۷۸', tel: '+982112345678' });
    expect(formatSupportPhone('دفتر', '۰۲۱-۱۲۳۴-۵۶۷۸')?.tel).toBe('+982112345678');
  });
  it('rejects invalid numbers and empty labels', () => {
    expect(formatSupportPhone('x', '12345')).toBeNull();
    expect(formatSupportPhone('', '09121234567')).toBeNull();
    expect(formatSupportPhone('x', 'javascript:alert(1)')).toBeNull();
  });
  it('parses the SUPPORT_PHONES env fallback', () => {
    expect(supportPhones({ SUPPORT_PHONES: 'فروش:09121234567;bad:1;دفتر:02112345678' }).map(p => p.tel)).toEqual(['+989121234567', '+982112345678']);
    expect(supportPhones({})).toEqual([]);
  });
});

describe('getSupportContact', () => {
  it('reads numbers and hours from the database', async () => {
    db([{ label: 'پشتیبانی', phone: '+989121234567' }, { label: 'خراب', phone: '+1555' }], 'همه‌روزه');
    const c = await getSupportContact({ SUPPORT_PHONES: 'env:02112345678' });
    expect(c.phones.map(p => p.label)).toEqual(['پشتیبانی']);
    expect(c.hours).toBe('همه‌روزه');
  });
  it('falls back to env only while the table is empty', async () => {
    db([], null);
    const c = await getSupportContact({ SUPPORT_PHONES: 'env:02112345678', SUPPORT_HOURS: 'ساعت env' });
    expect(c.phones.map(p => p.tel)).toEqual(['+982112345678']);
    expect(c.hours).toBe('ساعت env');
  });
  it('shows no phone rows (and no placeholders) when nothing is configured', async () => {
    db([], 'شنبه تا پنج‌شنبه، ۹ صبح تا ۹ شب');
    const c = await getSupportContact({});
    expect(c.phones).toEqual([]);
    expect(c.hours).toContain('شنبه');
  });
});

describe('admin-side contact writes', () => {
  const client = { query: vi.fn() };
  beforeEach(() => {
    vi.mocked(withUserTransaction).mockImplementation((async (_u: string, fn: (c: unknown) => unknown) => fn(client)) as never);
    client.query.mockResolvedValue({ rows: [{ id: 'c1' }], rowCount: 1 });
  });
  it('stores numbers in E.164 and audits the change', async () => {
    await upsertSupportContact({ label: 'فروش', phone: '0912 123 4567' }, 'admin-1');
    expect(client.query.mock.calls[0][1]).toEqual(['فروش', '+989121234567', 0, true]);
    expect(client.query.mock.calls[1][0]).toMatch(/audit_logs/);
  });
  it('rejects an invalid number', async () => {
    await expect(upsertSupportContact({ label: 'x', phone: '123' }, 'admin-1')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('validates the hours text', async () => {
    await expect(setSupportHours('', 'a')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await setSupportHours('  هر روز   ۹ تا ۲۱ ', 'a');
    expect(client.query.mock.calls[0][1]).toEqual(['هر روز ۹ تا ۲۱']);
  });
});

describe('GET /api/v1/app/trust', () => {
  let GET: typeof import('../../app/api/v1/app/trust/route').GET;
  beforeAll(async () => { ({ GET } = await import('../../app/api/v1/app/trust/route')); }, 60000);
  it('returns licences, phones and hours without a session', async () => {
    db([{ label: 'پشتیبانی', phone: '+989121234567' }], 'شنبه تا پنج‌شنبه');
    const res = await GET({ headers: { get: () => null } } as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.licenses.map((l: { key: string }) => l.key)).toEqual(['enamad', 'samandehi', 'union']);
    expect(data.phones).toEqual([{ label: 'پشتیبانی', display: '۰۹۱۲ ۱۲۳ ۴۵۶۷', tel: '+989121234567' }]);
    expect(data.hours).toBe('شنبه تا پنج‌شنبه');
  });
  it('returns a JSON error envelope when the database is down', async () => {
    mockQuery.mockRejectedValue(new Error('down'));
    const res = await GET({ headers: { get: () => null } } as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('INTERNAL_ERROR');
  });
});
