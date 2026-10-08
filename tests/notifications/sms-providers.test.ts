import { afterEach, describe, expect, it, vi } from 'vitest';
import { MelipayamakSmsProvider } from '../../server/notifications/sms/melipayamak';
import { allowConsoleSmsProvider, ConsoleSmsProvider } from '../../server/notifications/sms/console';
import { SmsProviderError, smsErrorMessage } from '../../server/notifications/sms/types';

function fetchReturning(status: number, body: string) {
  return vi.fn().mockResolvedValue(new Response(body, { status, headers: { 'content-type': 'application/json' } }));
}

describe('Melipayamak pattern adapter (mocked fetch; live API untested in this sandbox)', () => {
  it('POSTs bodyId/to/args to the console shared endpoint with the local number', async () => {
    const f = fetchReturning(200, '{"recId":9007199254740993123,"status":"ارسال موفق بود"}');
    const p = new MelipayamakSmsProvider({ apiKey: 'KEY/1', otpPatternId: '123456' }, f as unknown as typeof fetch);
    const r = await p.sendPattern('+989121234567', '777', ['ZP-4A1C9E', '4A1C9E']);
    // recId is read from the raw text so a 64-bit id is not rounded.
    expect(r.providerReference).toBe('9007199254740993123');
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://console.melipayamak.com/api/send/shared/KEY%2F1');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ bodyId: 777, to: '09121234567', args: ['ZP-4A1C9E', '4A1C9E'] });
  });

  it('sendOtp uses the OTP pattern with the code as the only argument', async () => {
    const f = fetchReturning(200, '{"recId":123456789,"status":""}');
    await new MelipayamakSmsProvider({ apiKey: 'k', otpPatternId: '42' }, f as unknown as typeof fetch).sendOtp('+989121234567', '012345');
    expect(JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)).toEqual({ bodyId: 42, to: '09121234567', args: ['012345'] });
  });

  it('strips separators that would corrupt pattern arguments', async () => {
    const f = fetchReturning(200, '{"recId":123456789}');
    await new MelipayamakSmsProvider({ apiKey: 'k', otpPatternId: '42' }, f as unknown as typeof fetch).sendPattern('+989121234567', '1', ['a;b\nc']);
    expect(JSON.parse((f.mock.calls[0][1] as RequestInit).body as string).args).toEqual(['a b c']);
  });

  it('maps a small recId error code to a non-retryable rejection', async () => {
    const f = fetchReturning(200, '{"recId":-1,"status":"نام کاربری یا رمز عبور اشتباه است"}');
    const err = await new MelipayamakSmsProvider({ apiKey: 'k', otpPatternId: '1' }, f as unknown as typeof fetch).sendOtp('+989121234567', '111111').catch(e => e);
    expect(err).toBeInstanceOf(SmsProviderError);
    expect(err.kind).toBe('rejected');
    expect(err.retryable).toBe(false);
  });

  it('maps 5xx and network failures to retryable unavailability', async () => {
    const e1 = await new MelipayamakSmsProvider({ apiKey: 'k', otpPatternId: '1' }, fetchReturning(503, '') as unknown as typeof fetch).sendOtp('+989121234567', '1').catch(e => e);
    expect(e1.kind).toBe('unavailable');
    const down = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const e2 = await new MelipayamakSmsProvider({ apiKey: 'k', otpPatternId: '1' }, down as unknown as typeof fetch).sendOtp('+989121234567', '1').catch(e => e);
    expect(e2.kind).toBe('unavailable');
    expect(e2.retryable).toBe(true);
  });

  it('refuses when not configured, without calling the network', async () => {
    const f = vi.fn();
    const err = await new MelipayamakSmsProvider({ apiKey: '', otpPatternId: '1' }, f as unknown as typeof fetch).sendOtp('+989121234567', '1').catch(e => e);
    expect(err.kind).toBe('not_configured');
    expect(f).not.toHaveBeenCalled();
  });

  it('gives customers a Persian sentence and never the provider detail', () => {
    expect(smsErrorMessage(new SmsProviderError('not_configured', 'x'))).toMatch(/در دسترس نیست/);
    expect(smsErrorMessage(new SmsProviderError('unavailable', 'x'))).toMatch(/تأخیر/);
    expect(smsErrorMessage(new SmsProviderError('rejected', 'secret detail'))).not.toMatch(/secret/);
  });
});

describe('console SMS provider', () => {
  afterEach(() => vi.restoreAllMocks());
  it('is refused in production except an explicit local-only opt-in on a loopback site URL', () => {
    expect(allowConsoleSmsProvider({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
    expect(allowConsoleSmsProvider({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
    expect(allowConsoleSmsProvider({ NODE_ENV: 'production', SMS_CONSOLE_LOCAL_ONLY: 'true', NEXT_PUBLIC_SITE_URL: 'https://zohalpay.ir' } as NodeJS.ProcessEnv)).toBe(false);
    expect(allowConsoleSmsProvider({ NODE_ENV: 'production', SMS_CONSOLE_LOCAL_ONLY: 'true', NEXT_PUBLIC_SITE_URL: 'http://localhost:3250' } as NodeJS.ProcessEnv)).toBe(true);
  });
  it('logs a masked number', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await new ConsoleSmsProvider().sendPattern('+989121234567', 'order_registered', ['ZP-1']);
    expect(log.mock.calls[0][0]).toContain('0912 ••• 4567');
    expect(log.mock.calls[0][0]).not.toContain('09121234567');
  });
});
