import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock('../../server/identity/step-up', () => ({ enforceStepUpPolicy: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({ assertSameOrigin: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/core/platform-settings', () => ({ getPlatformSetting: vi.fn(), setPlatformSetting: vi.fn() }));
vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withUserTransaction: vi.fn(async (_u: string, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});

import { requireRequestUser } from '../../server/identity/request-user';
import { requirePlatformAdmin } from '../../server/identity/platform-admin';
import { enforceStepUpPolicy } from '../../server/identity/step-up';
import { assertSameOrigin } from '../../server/core/security-boundary';
import { writeAudit } from '../../server/core/audit';
import { getPlatformSetting, setPlatformSetting } from '../../server/core/platform-settings';
import { query } from '../../server/core/db';
import { AppError } from '../../server/core/errors';
import { getSettingsOverview, saveGateway, saveGoogle, saveInvoice, saveLicenses, saveSms, secretView } from '../../server/admin/settings';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const ctx = { actorUserId: ADMIN };
const mockGet = vi.mocked(getPlatformSetting);
const mockSet = vi.mocked(setPlatformSetting);
const mockQuery = vi.mocked(query);
const stored = (value: unknown, secret: unknown = null) => ({ value, secret, updatedAt: null }) as never;

beforeEach(() => {
  vi.resetAllMocks();
  mockGet.mockResolvedValue(stored(null));
  vi.mocked(requireRequestUser).mockResolvedValue(ADMIN as never);
});

describe('secretView', () => {
  it('shows only a registered flag and the last 4 characters of long secrets', () => {
    expect(secretView('abcdefghijklmnop')).toEqual({ set: true, last4: 'mnop', source: 'panel' });
    expect(secretView('short')).toEqual({ set: true, last4: null, source: 'panel' });
    expect(secretView(undefined, 'env-value')).toEqual({ set: true, last4: null, source: 'env' });
    expect(secretView(undefined, undefined)).toEqual({ set: false, last4: null, source: null });
  });
});

describe('getSettingsOverview', () => {
  it('never returns a secret value to the browser', async () => {
    mockGet.mockImplementation((async (key: string) => {
      if (key === 'sms.melipayamak') return stored({ patterns: { otp: '123' }, inbound: { enabled: true } }, { apiKey: 'SECRET-SMS-KEY-123456', inboundSecret: 'SECRET-INBOUND-SECRET-ABCDEFG' });
      if (key === 'auth.google') return stored({ clientId: 'x.apps.googleusercontent.com' }, { clientSecret: 'SECRET-GOOGLE-CLIENT-9999' });
      if (key === 'payments.gateway') return stored({ gateway: 'zarinpal', enabled: false }, { merchantId: 'SECRET-MERCHANT-0000-1111' });
      return stored(null);
    }) as never);
    mockQuery.mockImplementation((async (sql: string) => ({
      rows: /invoice_settings/.test(sql) ? [{ seller_legal_name: 'زحل', seller_national_id: '', seller_economic_code: '', seller_address: '', seller_postal_code: '', seller_phone: '', vat_enabled: false, vat_rate_bps: 900 }] : [],
    })) as never);
    const o = await getSettingsOverview(ADMIN, {} as NodeJS.ProcessEnv);
    const dump = JSON.stringify(o);
    expect(dump).not.toMatch(/SECRET-/);
    expect(o.sms.apiKey).toEqual({ set: true, last4: '3456', source: 'panel' });
    expect(o.google.clientSecret.last4).toBe('9999');
    expect(o.gateway.merchantId.last4).toBe('1111');
    expect(o.gateway.adapterReady).toBe(false);
    expect(o.invoice.vatPercent).toBe(9);
    expect(o.sms.patterns).toEqual({ otp: '123' });
  });

  it('is refused for non-admins', async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new AppError('FORBIDDEN', 'x'));
    await expect(getSettingsOverview('u')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('saveSms', () => {
  it('stores patterns, merges secrets and keeps the inbound secret when only the API key changes', async () => {
    mockGet.mockResolvedValue(stored({ patterns: { otp: '1' }, inbound: { enabled: false, fromField: 'from' } }, { apiKey: 'OLD-KEY-OLD-KEY', inboundSecret: 'INBOUND-SECRET-INBOUND-SECRET' }));
    await saveSms(ctx, { apiKey: 'NEW-API-KEY-1234', patterns: { order_completed: '۱۲۳۴' } });
    const [key, input, actor] = mockSet.mock.calls[0] as [string, { value: Record<string, unknown>; secret: Record<string, string> }, string];
    expect(key).toBe('sms.melipayamak');
    expect(actor).toBe(ADMIN);
    expect(input.secret).toEqual({ apiKey: 'NEW-API-KEY-1234', inboundSecret: 'INBOUND-SECRET-INBOUND-SECRET' });
    expect(input.value.patterns).toEqual({ otp: '1', order_completed: '1234' });
    expect((input.value.inbound as Record<string, unknown>).fromField).toBe('from');
    expect(vi.mocked(enforceStepUpPolicy)).toHaveBeenCalledWith(ADMIN, 'SECURITY_SETTINGS_CHANGE', undefined);
  });

  it('leaves secrets untouched (secret undefined) when only patterns change and skips step-up', async () => {
    await saveSms(ctx, { patterns: { otp: '55' } });
    expect((mockSet.mock.calls[0][1] as { secret: unknown }).secret).toBeUndefined();
    expect(vi.mocked(enforceStepUpPolicy)).not.toHaveBeenCalled();
  });

  it('rejects bad pattern ids, short inbound secrets and writes nothing', async () => {
    await expect(saveSms(ctx, { patterns: { otp: 'abc' } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(saveSms(ctx, { inboundSecret: 'tooshort' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(saveSms(ctx, { apiKey: 'has space inside' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does not save when the step-up policy rejects', async () => {
    vi.mocked(enforceStepUpPolicy).mockRejectedValueOnce(new AppError('FORBIDDEN', 'step-up'));
    await expect(saveSms(ctx, { apiKey: 'NEW-API-KEY-1234' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('saveGoogle / saveGateway', () => {
  it('validates the Google client id and requires it to enable', async () => {
    await expect(saveGoogle(ctx, { clientId: 'evil.example.com' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(saveGoogle(ctx, { enabled: true })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await saveGoogle(ctx, { clientId: '123-abc.apps.googleusercontent.com', clientSecret: 'GOCSPX-secretsecret' });
    expect(mockSet).toHaveBeenCalledWith('auth.google', { value: { clientId: '123-abc.apps.googleusercontent.com', enabled: true }, secret: { clientSecret: 'GOCSPX-secretsecret' } }, ADMIN);
  });

  it('refuses to enable the gateway without a merchant id, unknown gateways, and encrypts the merchant id as a secret', async () => {
    await expect(saveGateway(ctx, { gateway: 'zarinpal', enabled: true })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(saveGateway(ctx, { gateway: 'evilpay' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await saveGateway(ctx, { gateway: 'zarinpal', merchantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', enabled: true });
    expect(mockSet).toHaveBeenCalledWith('payments.gateway', { value: { gateway: 'zarinpal', enabled: true }, secret: { merchantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } }, ADMIN);
  });

  it('clears a secret only on an explicit {clear:true}', async () => {
    await saveGateway(ctx, { merchantId: { clear: true } });
    expect((mockSet.mock.calls[0][1] as { secret: unknown }).secret).toBeNull();
  });
});

describe('saveLicenses', () => {
  it('accepts only https links on the issuer hosts and supports clearing', async () => {
    await expect(saveLicenses(ctx, { enamad: 'https://evil.example.com/x' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(saveLicenses(ctx, { enamad: 'http://trustseal.enamad.ir/?id=1' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await saveLicenses(ctx, { enamad: 'https://trustseal.enamad.ir/?id=1&Code=abc' });
    expect(mockSet.mock.calls[0][1]).toMatchObject({ value: { enamad: 'https://trustseal.enamad.ir/?id=1&Code=abc' } });
    mockGet.mockResolvedValue(stored({ enamad: 'https://trustseal.enamad.ir/?id=1' }));
    await saveLicenses(ctx, { enamad: '' });
    expect((mockSet.mock.calls[1][1] as { value: object }).value).toEqual({});
  });
});

describe('saveInvoice', () => {
  const full = { legalName: 'شرکت زحل', nationalId: '۱۴۰۰۱۲۳۴۵۶۷', economicCode: '411234567890', address: 'تهران', postalCode: '1234567890', phone: '021', vatEnabled: true, vatPercent: 10 };

  it('writes the settings row and audits the VAT change inside one transaction', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ vat_enabled: false, vat_rate_bps: 1000 }] } as never).mockResolvedValue({ rows: [] } as never);
    await saveInvoice(ctx, full);
    const upsert = mockQuery.mock.calls.find(c => /INSERT INTO invoice_settings/.test(String(c[0])))!;
    expect(upsert[1]).toEqual(['شرکت زحل', '14001234567', '411234567890', 'تهران', '1234567890', '021', true, 1000, ADMIN]);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin.settings.invoice', metadata: expect.objectContaining({ vatFrom: { enabled: false, bps: 1000 }, vatTo: { enabled: true, bps: 1000 } }),
    }), expect.anything());
  });

  it('refuses to turn VAT on without a legal name and economic code, and rejects bad rates/ids', async () => {
    await expect(saveInvoice(ctx, { ...full, legalName: '' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(saveInvoice(ctx, { ...full, economicCode: '' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(saveInvoice(ctx, { ...full, vatPercent: 120 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(saveInvoice(ctx, { ...full, postalCode: '12' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

type SettingsRoute = typeof import('../../app/api/v1/admin/settings/[section]/route');
let POST: SettingsRoute['POST'];
beforeAll(async () => { ({ POST } = await import('../../app/api/v1/admin/settings/[section]/route')); }, 60000);
const req = (body: unknown) => ({ headers: { get: () => null }, url: 'http://localhost:3000/x', method: 'POST', json: async () => body }) as never;
const sec = (section: string) => ({ params: Promise.resolve({ section }) });

describe('POST /api/v1/admin/settings/[section]', () => {
  it('saves and answers {ok:true} without echoing any submitted secret', async () => {
    const res = await POST(req({ apiKey: 'NEW-API-KEY-1234' }), sec('sms'));
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).toBe('{"ok":true}');
  });

  it('rejects cross-origin, non-admin, bad body and unknown sections without writing', async () => {
    vi.mocked(assertSameOrigin).mockImplementationOnce(() => { throw new AppError('FORBIDDEN', 'cross'); });
    expect((await POST(req({}), sec('sms'))).status).toBe(403);
    vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new AppError('FORBIDDEN', 'x'));
    expect((await POST(req({}), sec('sms'))).status).toBe(403);
    expect((await POST(req(null), sec('sms'))).status).toBe(400);
    expect((await POST(req({}), sec('nope'))).status).toBe(404);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('passes the step-up evidence id to the policy check and surfaces its refusal', async () => {
    vi.mocked(enforceStepUpPolicy).mockRejectedValueOnce(new AppError('FORBIDDEN', 'step-up'));
    const res = await POST(req({ apiKey: 'NEW-API-KEY-1234', stepUpEvidenceId: 'ev-1' }), sec('sms'));
    expect(res.status).toBe(403);
    expect(vi.mocked(enforceStepUpPolicy)).toHaveBeenCalledWith(ADMIN, 'SECURITY_SETTINGS_CHANGE', 'ev-1');
    expect(mockSet).not.toHaveBeenCalled();
  });
});
