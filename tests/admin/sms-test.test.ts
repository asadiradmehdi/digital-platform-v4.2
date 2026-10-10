import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/admin/access', () => ({ requirePermission: vi.fn(), requireAnyPermission: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/core/platform-settings', () => ({ getPlatformSetting: vi.fn(), setPlatformSetting: vi.fn() }));
vi.mock('../../server/identity/step-up', () => ({ enforceStepUpPolicy: vi.fn() }));
vi.mock('../../server/core/db', () => ({ query: vi.fn(), withUserTransaction: vi.fn() }));
vi.mock('../../server/notifications/sms/config', async orig => ({ ...(await orig<object>()), getSmsProvider: vi.fn() }));

import { requirePermission } from '../../server/admin/access';
import { writeAudit } from '../../server/core/audit';
import { getSmsProvider } from '../../server/notifications/sms/config';
import { SmsProviderError } from '../../server/notifications/sms/types';
import { sendSmsTest } from '../../server/admin/settings';

const ctx = { actorUserId: '11111111-1111-4111-8111-111111111111' };
const providerWith = (sendOtp: () => Promise<{ providerReference: string }>, name = 'melipayamak') =>
  vi.mocked(getSmsProvider).mockResolvedValue({ config: {}, provider: { name, sendOtp, sendPattern: vi.fn() } } as never);

beforeEach(() => vi.resetAllMocks());

describe('sendSmsTest', () => {
  it('sends a code to a valid mobile, checks the permission and audits', async () => {
    const sendOtp = vi.fn().mockResolvedValue({ providerReference: '123456' });
    providerWith(sendOtp);
    await sendSmsTest(ctx, '۰۹۱۲۳۴۵۶۷۸۹');
    expect(requirePermission).toHaveBeenCalledWith(ctx.actorUserId, 'notifications.manage');
    expect(sendOtp).toHaveBeenCalledWith('+989123456789', expect.stringMatching(/^\d{5}$/));
    expect(writeAudit).toHaveBeenCalled();
  });
  it('rejects an invalid number without sending', async () => {
    const sendOtp = vi.fn();
    providerWith(sendOtp);
    await expect(sendSmsTest(ctx, '12345')).rejects.toThrow();
    expect(sendOtp).not.toHaveBeenCalled();
  });
  it('refuses when no real provider is configured', async () => {
    vi.mocked(getSmsProvider).mockResolvedValue({ config: {}, provider: null } as never);
    await expect(sendSmsTest(ctx, '09123456789')).rejects.toThrow();
  });
  it('turns a panel refusal into a Persian error that does not leak provider details', async () => {
    providerWith(() => Promise.reject(new SmsProviderError('rejected', 'Melipayamak refused the message (-1: bad key).')));
    await expect(sendSmsTest(ctx, '09123456789')).rejects.toThrow(/پنل پیامک/);
  });
});
